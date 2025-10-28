import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { randomUUID } from "crypto";
import { secret } from "encore.dev/config";
import db from "../db";
import * as formidable from "formidable";
import * as fs from "fs";

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
      
      // Parse the multipart form data
      const form = formidable.formidable({
        keepExtensions: true,
        maxFileSize: 500 * 1024 * 1024, // 500MB
      });

      const [fields, files] = await form.parse(req);
      
      console.log("[Upload] Fields:", fields);
      console.log("[Upload] Files:", Object.keys(files));

      const conversationId = fields.conversationId?.[0];
      const uploadedFile = files.file?.[0];

      if (!conversationId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No conversation ID provided" }));
        return;
      }

      if (!uploadedFile) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No file provided" }));
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

      console.log(`[Upload] File: ${uploadedFile.originalFilename}, Size: ${uploadedFile.size}`);
      console.log(`[Upload] Uploading for conversation: ${conversationId}`);

      // Create FormData for Memories.ai - matching Python requests library behavior
      const formData = new FormData();
      
      // Read the file and create a Blob
      const fileBuffer = fs.readFileSync(uploadedFile.filepath);
      const blob = new Blob([fileBuffer], { type: uploadedFile.mimetype || 'video/mp4' });
      
      // Add file - this goes in the 'files' part
      formData.append("file", blob, uploadedFile.originalFilename || "video.mp4");
      
      // Add data fields - these go in the 'data' part (as regular form fields, not JSON)
      formData.append("unique_id", auth.userID);
      formData.append("retain_original_video", "True"); // Python boolean as string
      
      // Tags should be an array - send as multiple form fields or JSON string
      const tags = [conversationId, "chat-upload", new Date().toISOString().split("T")[0]];
      tags.forEach(tag => {
        formData.append("tags", tag);
      });

      console.log("[Upload] Uploading to Memories.ai...");

      // Upload to Memories.ai
      const apiKey = memoriesApiKey();
      
      console.log("[Upload] API Key present:", apiKey ? "YES" : "NO");
      console.log("[Upload] API Key length:", apiKey?.length || 0);
      
      const uploadResponse = await fetch("https://api.memories.ai/serve/api/v1/upload", {
        method: "POST",
        headers: {
          "Authorization": apiKey,
        },
        body: formData,
      });

      console.log("[Upload] Memories.ai response status:", uploadResponse.status);
      console.log("[Upload] Response headers:", Object.fromEntries(uploadResponse.headers.entries()));

      // Clean up temp file
      try {
        fs.unlinkSync(uploadedFile.filepath);
      } catch (e) {
        console.warn("[Upload] Failed to delete temp file:", e);
      }

      const responseText = await uploadResponse.text();
      console.log("[Upload] Raw response:", responseText);

      if (!uploadResponse.ok) {
        console.error("[Upload] Memories.ai error response:", responseText);
        throw new Error(`Memories.ai upload failed: ${uploadResponse.status} - ${responseText}`);
      }

      let result: { code: string; msg: string; data: UploadFileResponse };
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("[Upload] Failed to parse response as JSON:", e);
        throw new Error(`Invalid JSON response from Memories.ai: ${responseText}`);
      }
      
      console.log("[Upload] Parsed result:", result);
      
      if (result.code !== "0000") {
        throw new Error(`Memories.ai error (code ${result.code}): ${result.msg}`);
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
