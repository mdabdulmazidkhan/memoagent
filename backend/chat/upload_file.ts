import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { randomUUID } from "crypto";
import { memoriesClient } from "../mcp/memories";
import db from "../db";

interface UploadFileResponse {
  videoNo: string;
  videoName: string;
  videoStatus: string;
  uploadTime: string;
}

export const uploadFile = api.raw(
  { auth: true, expose: true, method: "POST", path: "/chat/upload" },
  async (req, res) => {
    const auth = getAuthData()!;
    
    try {
      console.log("[Upload] Receiving file upload request");
      
      // Get form data from request
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const conversationId = formData.get("conversationId") as string | null;
      
      if (!file) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No file provided" }));
        return;
      }
      
      if (!conversationId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No conversation ID provided" }));
        return;
      }

      // Verify conversation belongs to user
      const conversation = await db.queryRow<{ id: string }>`
        SELECT id FROM conversations WHERE id = ${conversationId} AND user_id = ${auth.userID}
      `;

      if (!conversation) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Conversation not found or access denied" }));
        return;
      }

      console.log(`[Upload] File: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

      // Create new FormData for Memories.ai API
      const memoriesFormData = new FormData();
      memoriesFormData.append("file", file);
      memoriesFormData.append("unique_id", auth.userID);
      memoriesFormData.append("retain_original_video", "true");
      
      // Add tags for organization
      memoriesFormData.append("tags", JSON.stringify([
        conversationId,
        "chat-upload",
        new Date().toISOString().split("T")[0]
      ]));

      console.log("[Upload] Uploading to Memories.ai...");
      
      // Call Memories.ai upload endpoint
      const result = await memoriesClient.callTool("uploadVideoFile", {
        formData: memoriesFormData
      }) as UploadFileResponse;

      console.log("[Upload] Upload successful:", result);

      // Save video reference to database
      const videoId = randomUUID();
      await db.exec`
        INSERT INTO conversation_videos (id, conversation_id, video_no, video_name, status)
        VALUES (${videoId}, ${conversationId}, ${result.videoNo}, ${result.videoName}, ${result.videoStatus})
      `;

      console.log(`[Upload] Saved video ${result.videoNo} to conversation ${conversationId}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      
    } catch (error) {
      console.error("[Upload] Error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : "Upload failed" 
      }));
    }
  }
);

