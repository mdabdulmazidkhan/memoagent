import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { randomUUID } from "crypto";
import { secret } from "encore.dev/config";
import db from "../db";
import * as formidable from "formidable";
import * as fs from "fs";
import * as FormData from "form-data";

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
      
      // Parse the multipart form data from client
      const form = formidable.formidable({
        keepExtensions: true,
        maxFileSize: 500 * 1024 * 1024, // 500MB
      });

      const [fields, files] = await form.parse(req);
      
      console.log("[Upload] Fields:", Object.keys(fields));
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
      console.log(`[Upload] File path: ${uploadedFile.filepath}`);
      console.log(`[Upload] Uploading for conversation: ${conversationId}`);

      // Create multipart form data for Memories.ai using form-data package
      const formData = new FormData();
      
      // Add file stream - matching Python requests files parameter
      const fileStream = fs.createReadStream(uploadedFile.filepath);
      formData.append("file", fileStream, {
        filename: uploadedFile.originalFilename || "video.mp4",
        contentType: uploadedFile.mimetype || "video/mp4"
      });
      
      // Add data fields - matching Python requests data parameter
      formData.append("unique_id", auth.userID);
      formData.append("retain_original_video", "true");
      
      // Tags as individual array items
      const tags = [conversationId, "chat-upload", new Date().toISOString().split("T")[0]];
      tags.forEach(tag => {
        formData.append("tags", tag);
      });

      console.log("[Upload] Uploading to Memories.ai...");

      // Upload to Memories.ai
      const apiKey = memoriesApiKey();
      
      console.log("[Upload] API Key present:", apiKey ? "YES" : "NO");
      console.log("[Upload] API Key length:", apiKey?.length || 0);

      // Use form-data's submit method which handles the request properly
      const uploadPromise = new Promise<{ code: string; msg: string; data: UploadFileResponse }>((resolve, reject) => {
        formData.submit({
          protocol: "https:",
          host: "api.memories.ai",
          path: "/serve/api/v1/upload",
          method: "POST",
          headers: {
            "Authorization": apiKey
          }
        }, (err, uploadResponse) => {
          if (err) {
            reject(err);
            return;
          }

          console.log("[Upload] Memories.ai response status:", uploadResponse.statusCode);

          let responseData = "";
          uploadResponse.on("data", (chunk) => {
            responseData += chunk.toString();
          });

          uploadResponse.on("end", () => {
            console.log("[Upload] Raw response:", responseData);

            if (uploadResponse.statusCode !== 200) {
              reject(new Error(`Memories.ai upload failed: ${uploadResponse.statusCode} - ${responseData}`));
              return;
            }

            try {
              const result = JSON.parse(responseData);
              resolve(result);
            } catch (e) {
              reject(new Error(`Invalid JSON response: ${responseData}`));
            }
          });

          uploadResponse.on("error", (err) => {
            reject(err);
          });
        });
      });

      const result = await uploadPromise;

      // Clean up temp file
      try {
        fs.unlinkSync(uploadedFile.filepath);
      } catch (e) {
        console.warn("[Upload] Failed to delete temp file:", e);
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
