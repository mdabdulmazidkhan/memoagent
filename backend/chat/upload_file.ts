import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { randomUUID } from "crypto";
import { secret } from "encore.dev/config";
import db from "../db";

const memoriesApiKey = secret("MemoriesApiKey");

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
      console.log("[Upload] Content-Type:", req.headers["content-type"]);
      
      // Parse multipart form data manually
      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("multipart/form-data")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Expected multipart/form-data" }));
        return;
      }

      // Get the boundary from content-type header
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No boundary found in content-type" }));
        return;
      }

      // Read the request body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);

      console.log("[Upload] Received body size:", body.length);

      // Extract conversationId from form data (simple text parsing)
      const bodyStr = body.toString();
      const conversationIdMatch = bodyStr.match(/name="conversationId"\r\n\r\n([^\r\n]+)/);
      const conversationId = conversationIdMatch ? conversationIdMatch[1] : null;

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

      console.log(`[Upload] Uploading for conversation: ${conversationId}`);

      // Forward the entire form data to Memories.ai
      const apiKey = memoriesApiKey();
      const uploadResponse = await fetch("https://api.memories.ai/serve/api/v1/upload", {
        method: "POST",
        headers: {
          "Authorization": apiKey,
          "Content-Type": contentType,
        },
        body: body,
      });

      console.log("[Upload] Memories.ai response status:", uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("[Upload] Memories.ai error:", errorText);
        throw new Error(`Memories.ai upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const result = await uploadResponse.json() as { code: string; msg: string; data: UploadFileResponse };
      
      if (result.code !== "0000") {
        throw new Error(`Memories.ai error: ${result.msg}`);
      }

      console.log("[Upload] Upload successful:", result.data);

      // Save video reference to database
      const videoId = randomUUID();
      await db.exec`
        INSERT INTO conversation_videos (id, conversation_id, video_no, video_name, status)
        VALUES (${videoId}, ${conversationId}, ${result.data.videoNo}, ${result.data.videoName}, ${result.data.videoStatus})
      `;

      console.log(`[Upload] Saved video ${result.data.videoNo} to conversation ${conversationId}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.data));
      
    } catch (error) {
      console.error("[Upload] Error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : "Upload failed" 
      }));
    }
  }
);
