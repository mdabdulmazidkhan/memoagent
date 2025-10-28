import { api, StreamOut } from "encore.dev/api";
import { randomUUID } from "crypto";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { streamChatCompletion } from "./openrouter";
import type { OpenRouterMessage } from "./openrouter";
import { mcpClient } from "../mcp/runware";
import { memoriesClient } from "../mcp/memories";

interface SendMessageRequest {
  conversationId: string;
  content: string;
}

interface MessageChunk {
  type: "chunk" | "done" | "tool_call";
  content?: string;
  messageId?: string;
  toolName?: string;
  toolResult?: unknown;
}

async function checkMCPTools(userMessage: string): Promise<{ shouldUseMCP: boolean; toolName?: string; args?: Record<string, unknown>; client?: "runware" | "memories" }> {
  try {
    const messageLower = userMessage.toLowerCase();
    
    // MEMORIES.AI VIDEO ANALYSIS
    // Upload video from URL
    if ((messageLower.includes("upload") || messageLower.includes("analyze") || messageLower.includes("index")) && 
        (messageLower.includes("video") || messageLower.includes("url"))) {
      
      const urlMatch = userMessage.match(/https?:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : "placeholder";
      
      // Check if it's a platform URL (TikTok, YouTube, Instagram)
      if (url.includes("tiktok.com") || url.includes("youtube.com") || url.includes("youtu.be") || 
          url.includes("instagram.com") || url.includes("facebook.com")) {
        return {
          shouldUseMCP: true,
          client: "memories",
          toolName: "uploadVideoFromPlatform",
          args: {
            videoUrls: [url],
            quality: 1080
          }
        };
      } else {
        return {
          shouldUseMCP: true,
          client: "memories",
          toolName: "uploadVideoFromURL",
          args: { url }
        };
      }
    }
    
    // Chat with specific videos
    if ((messageLower.includes("tell me about") || messageLower.includes("what") || messageLower.includes("summarize")) && 
        messageLower.includes("video")) {
      
      const videoIdMatch = userMessage.match(/VI\d+/);
      if (videoIdMatch) {
        return {
          shouldUseMCP: true,
          client: "memories",
          toolName: "chatWithVideos",
          args: {
            videoNos: [videoIdMatch[0]],
            prompt: userMessage
          }
        };
      }
    }
    
    // Chat with personal media library
    if ((messageLower.includes("when did i") || messageLower.includes("find my video") || 
         messageLower.includes("show me videos")) && !messageLower.includes("generate")) {
      return {
        shouldUseMCP: true,
        client: "memories",
        toolName: "chatWithPersonalMedia",
        args: {
          prompt: userMessage
        }
      };
    }
    
    // Video market research
    if ((messageLower.includes("what does") || messageLower.includes("how is")) && 
        (messageLower.includes("post") || messageLower.includes("trending") || messageLower.includes("tiktok"))) {
      return {
        shouldUseMCP: true,
        client: "memories",
        toolName: "videoMarketerChat",
        args: {
          prompt: userMessage,
          type: messageLower.includes("youtube") ? "YOUTUBE" : 
                messageLower.includes("instagram") ? "INSTAGRAM" : "TIKTOK"
        }
      };
    }
    
    // Get transcription
    if (messageLower.includes("transcri") && messageLower.includes("video")) {
      const videoIdMatch = userMessage.match(/VI\d+/);
      if (videoIdMatch) {
        return {
          shouldUseMCP: true,
          client: "memories",
          toolName: messageLower.includes("audio") ? "getAudioTranscription" : "getVideoTranscription",
          args: {
            videoNo: videoIdMatch[0]
          }
        };
      }
    }
    
    // Generate summary
    if ((messageLower.includes("summary") || messageLower.includes("chapter") || messageLower.includes("topic")) && 
        messageLower.includes("video")) {
      const videoIdMatch = userMessage.match(/VI\d+/);
      if (videoIdMatch) {
        return {
          shouldUseMCP: true,
          client: "memories",
          toolName: "generateSummary",
          args: {
            videoNo: videoIdMatch[0],
            type: messageLower.includes("chapter") ? "CHAPTER" : "TOPIC"
          }
        };
      }
    }
    
    // VIDEO EDITING with uploaded videos
    if ((messageLower.includes("edit") || messageLower.includes("add") || messageLower.includes("change")) && 
        (messageLower.includes("video") || messageLower.includes("caption") || messageLower.includes("subtitle"))) {
      const videoIdMatch = userMessage.match(/VI\d+/);
      if (videoIdMatch) {
        return {
          shouldUseMCP: true,
          client: "memories",
          toolName: "chatWithVideos",
          args: {
            videoNos: [videoIdMatch[0]],
            prompt: userMessage + "\n\nPlease provide specific editing instructions or timestamps for the changes requested."
          }
        };
      }
    }
    
    // RUNWARE VIDEO GENERATION
    if (messageLower.includes("video")) {
      if (messageLower.includes("generate") || messageLower.includes("create") || messageLower.includes("make")) {
        // Extract prompt
        let prompt = userMessage;
        const prefixes = ["generate", "create", "make"];
        for (const prefix of prefixes) {
          const regex = new RegExp(`${prefix}\\s+(a\\s+)?video\\s+(of\\s+)?`, "i");
          prompt = prompt.replace(regex, "").trim();
        }
        
        // Check for image-to-video
        if (messageLower.includes("from image") || messageLower.includes("animate")) {
          return {
            shouldUseMCP: true,
            toolName: "imageToVideo",
            args: { 
              imageURL: "placeholder",  // User needs to provide
              prompt: prompt || "animate this image"
            }
          };
        }
        
        // Text-to-video
        return {
          shouldUseMCP: true,
          toolName: "videoInference",
          args: { 
            prompt: prompt,
            model: "bytedance:1@1",  // Seedance 1.0 Lite
            width: 864,
            height: 480,
            duration: 5,
            fps: 24
          }
        };
      }
    }
    
    // IMAGE GENERATION & MANIPULATION
    if (messageLower.includes("image") || messageLower.includes("picture") || 
        messageLower.includes("photo") || messageLower.includes("draw")) {
      
      // Caption image
      if (messageLower.includes("caption") || messageLower.includes("describe")) {
        return {
          shouldUseMCP: true,
          toolName: "captionImage",
          args: { imageURL: "placeholder" }
        };
      }
      
      // Image-to-image
      if ((messageLower.includes("transform") || messageLower.includes("modify") || 
           messageLower.includes("change")) && messageLower.includes("from")) {
        let prompt = userMessage;
        const regex = /transform|modify|change/i;
        prompt = prompt.replace(regex, "").trim();
        
        return {
          shouldUseMCP: true,
          toolName: "imageToImage",
          args: { 
            prompt: prompt,
            seedImage: "placeholder",
            strength: 0.7
          }
        };
      }
      
      // Inpainting
      if (messageLower.includes("inpaint") || messageLower.includes("edit part") || 
          messageLower.includes("replace part")) {
        return {
          shouldUseMCP: true,
          toolName: "imageInference",
          args: {
            prompt: userMessage,
            seedImage: "placeholder",
            maskImage: "placeholder"
          }
        };
      }
      
      // Background removal
      if (messageLower.includes("background") && messageLower.includes("remove")) {
        return {
          shouldUseMCP: true,
          toolName: "imageBackgroundRemoval",
          args: { imageURL: "placeholder" }
        };
      }
      
      // Upscale
      if (messageLower.includes("upscale") || messageLower.includes("enlarge") || 
          (messageLower.includes("enhance") && messageLower.includes("quality"))) {
        const factor = messageLower.includes("4x") ? 4 : messageLower.includes("3x") ? 3 : 2;
        return {
          shouldUseMCP: true,
          toolName: "imageUpscale",
          args: { imageURL: "placeholder", upscaleFactor: factor }
        };
      }
      
      // Image masking
      if (messageLower.includes("mask") || messageLower.includes("segment")) {
        return {
          shouldUseMCP: true,
          toolName: "imageMasking",
          args: { imageURL: "placeholder", prompt: "object to mask" }
        };
      }
      
      // Text-to-image (default for image generation)
      if (messageLower.includes("generate") || messageLower.includes("create") || 
          messageLower.includes("make") || messageLower.includes("of")) {
        
        let prompt = userMessage;
        const prefixes = ["generate", "create", "make", "draw"];
        for (const prefix of prefixes) {
          const regex = new RegExp(`${prefix}\\s+(an?\\s+)?(image|picture|photo)\\s+(of\\s+)?`, "i");
          prompt = prompt.replace(regex, "").trim();
        }
        
        // Check for model selection
        let model = "runware:100@1";  // Default: FLUX Schnell
        if (messageLower.includes("sdxl")) model = "civitai:4201@130090";
        else if (messageLower.includes("sd3")) model = "civitai:139562@297320";
        else if (messageLower.includes("flux")) model = "runware:100@1";
        
        return {
          shouldUseMCP: true,
          toolName: "imageInference",
          args: { 
            prompt: prompt,
            model: model,
            width: 512,
            height: 512,
            numberResults: 1,
            steps: 20
          }
        };
      }
    }
    
    // PROMPT ENHANCEMENT
    if (messageLower.includes("enhance prompt") || messageLower.includes("improve prompt")) {
      const prompt = userMessage.replace(/enhance|improve\s+prompt:?/i, "").trim();
      return {
        shouldUseMCP: true,
        toolName: "enhancePrompt",
        args: { prompt }
      };
    }
  } catch (error) {
    console.error("Error checking MCP tools:", error);
  }
  
  return { shouldUseMCP: false };
}

export const sendMessage = api.streamOut<SendMessageRequest, MessageChunk>(
  { auth: true, expose: true, path: "/chat/send" },
  async (req, stream) => {
    const auth = getAuthData()!;
    // Verify conversation belongs to user
    const conversation = await db.queryRow<{ id: string }>`
      SELECT id FROM conversations WHERE id = ${req.conversationId} AND user_id = ${auth.userID}
    `;

    if (!conversation) {
      await stream.send({ type: "done" });
      await stream.close();
      return;
    }

    // Save user message
    const userMessageId = randomUUID();
    const now = new Date();
    await db.exec`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (${userMessageId}, ${req.conversationId}, 'user', ${req.content}, ${now})
    `;

    // Get conversation history
    const history = await db.queryAll<{
      role: string;
      content: string;
    }>`
      SELECT role, content
      FROM messages
      WHERE conversation_id = ${req.conversationId}
      ORDER BY created_at ASC
    `;

    // Get uploaded videos for this conversation
    const uploadedVideos = await db.queryAll<{
      video_no: string;
      video_name: string;
      status: string;
    }>`
      SELECT video_no, video_name, status
      FROM conversation_videos
      WHERE conversation_id = ${req.conversationId}
      ORDER BY upload_time DESC
    `;

    // Build messages with system prompt
    const messages: OpenRouterMessage[] = [];
    
    // Add system prompt to guide behavior
    let systemPrompt = `You are a helpful AI assistant with access to powerful tools for image generation, video generation, and video analysis.

IMPORTANT RULES:
- Stay focused on the user's question - answer what they ask, nothing more
- Be concise and direct - avoid unnecessary elaboration
- When using tools, explain what you're doing briefly
- Only suggest capabilities when directly relevant to the user's request
- Don't offer unsolicited advice or go off-topic`;

    // Add context about uploaded videos if any exist
    if (uploadedVideos.length > 0) {
      const videoList = uploadedVideos.map(v => `- ${v.video_no} (${v.video_name})`).join('\n');
      systemPrompt += `\n\nUploaded videos in this conversation:\n${videoList}`;
    }

    messages.push({
      role: "system",
      content: systemPrompt
    });

    // Add conversation history
    messages.push(...history.map(msg => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content
    })));

    const assistantMessageId = randomUUID();
    let fullResponse = "";

    try {
      let mcpCheck = await checkMCPTools(req.content);
      
      // If user asks about uploaded videos without specifying ID, auto-inject video IDs
      if (mcpCheck.shouldUseMCP && mcpCheck.client === "memories" && uploadedVideos.length > 0) {
        const toolName = mcpCheck.toolName;
        
        // Auto-inject video IDs for chat/transcription/summary tools
        if ((toolName === "chatWithVideos" || toolName === "getVideoTranscription" || 
             toolName === "getAudioTranscription" || toolName === "generateSummary") &&
            (!mcpCheck.args?.videoNos && !mcpCheck.args?.videoNo)) {
          
          const videoNos = uploadedVideos
            .filter(v => v.status === "PARSE" || v.status === "UNPARSE")
            .map(v => v.video_no);
          
          if (videoNos.length > 0) {
            if (toolName === "chatWithVideos") {
              mcpCheck.args = {
                ...mcpCheck.args,
                videoNos: videoNos,
                prompt: req.content,
                uniqueId: auth.userID
              };
            } else {
              mcpCheck.args = {
                ...mcpCheck.args,
                videoNo: videoNos[0], // Use most recent
                uniqueId: auth.userID
              };
            }
            
            const contextMsg = `📹 Using uploaded video(s): ${videoNos.join(", ")}\n\n`;
            fullResponse += contextMsg;
            await stream.send({
              type: "chunk",
              content: contextMsg
            });
          }
        }
      }
      
      console.log("MCP Check result:", JSON.stringify(mcpCheck));
      
      if (mcpCheck.shouldUseMCP && mcpCheck.toolName) {
        const statusMsg = `🔧 Using MCP tool: ${mcpCheck.toolName}\n\n`;
        fullResponse += statusMsg;
        await stream.send({
          type: "chunk",
          content: statusMsg
        });

        // Define fallback models for different tools
        const fallbackModels: Record<string, string[]> = {
          videoInference: ["bytedance:1@1", "bytedance:2@1", "klingai:1@2"],
          imageInference: ["runware:100@1", "civitai:4201@130090", "civitai:139562@297320"]
        };

        let toolResult: unknown = null;
        let lastError: Error | null = null;
        const maxRetries = 3;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const currentArgs = { ...mcpCheck.args };
            
            // Use fallback model on retry
            if (attempt > 0 && fallbackModels[mcpCheck.toolName]) {
              const fallbackModel = fallbackModels[mcpCheck.toolName][attempt];
              if (fallbackModel) {
                currentArgs.model = fallbackModel;
                const retryMsg = `🔄 Retry ${attempt}/${maxRetries - 1} with model: ${fallbackModel}\n\n`;
                fullResponse += retryMsg;
                await stream.send({
                  type: "chunk",
                  content: retryMsg
                });
              }
            }
            
            console.log(`Calling MCP tool (attempt ${attempt + 1}):`, mcpCheck.toolName, "with args:", currentArgs);
            
            // Choose the correct client
            const client = mcpCheck.client === "memories" ? memoriesClient : mcpClient;
            toolResult = await client.callTool(mcpCheck.toolName, currentArgs || {});
            console.log("MCP tool result:", JSON.stringify(toolResult));
            
            // Format result as media
            let resultMsg = "";
            
            if (typeof toolResult === "string") {
              // Single URL returned
              if (toolResult.includes("mp4") || toolResult.includes("video")) {
                resultMsg = `✅ Video generated:\n\n![Video](${toolResult})`;
              } else if (toolResult.includes("png") || toolResult.includes("jpg") || toolResult.includes("image")) {
                resultMsg = `✅ Image generated:\n\n![Image](${toolResult})`;
              } else {
                resultMsg = `✅ Result: ${toolResult}`;
              }
            } else if (Array.isArray(toolResult)) {
              // Multiple URLs returned
              resultMsg = `✅ Generated ${toolResult.length} image(s):\n\n`;
              toolResult.forEach((url: string, idx: number) => {
                resultMsg += `![Image ${idx + 1}](${url})\n\n`;
              });
            } else {
              // Other result types
              resultMsg = `✅ Result:\n${JSON.stringify(toolResult, null, 2)}`;
            }
            
            fullResponse += resultMsg;
            
            await stream.send({
              type: "chunk",
              content: resultMsg
            });
            break; // Success - exit retry loop
            
          } catch (toolError) {
            lastError = toolError instanceof Error ? toolError : new Error(String(toolError));
            console.error(`MCP tool error (attempt ${attempt + 1}):`, lastError);
            
            // If this is the last attempt, show the error
            if (attempt === maxRetries - 1) {
              const errorMsg = `❌ Error after ${maxRetries} attempts: ${lastError.message}\n\n`;
              fullResponse += errorMsg;
              await stream.send({
                type: "chunk",
                content: errorMsg
              });
            }
          }
        }
      } else {
        console.log("Using OpenRouter for message:", req.content);
        for await (const chunk of streamChatCompletion(messages)) {
          fullResponse += chunk;
          await stream.send({
            type: "chunk",
            content: chunk
          });
        }
      }

      // Save assistant message
      await db.exec`
        INSERT INTO messages (id, conversation_id, role, content, created_at)
        VALUES (${assistantMessageId}, ${req.conversationId}, 'assistant', ${fullResponse}, ${new Date()})
      `;

      // Update conversation timestamp
      await db.exec`
        UPDATE conversations
        SET updated_at = ${new Date()}
        WHERE id = ${req.conversationId}
      `;

      // Update conversation title if it's the first message
      if (messages.length === 1) {
        const title = req.content.slice(0, 50) + (req.content.length > 50 ? "..." : "");
        await db.exec`
          UPDATE conversations
          SET title = ${title}
          WHERE id = ${req.conversationId}
        `;
      }

      await stream.send({
        type: "done",
        messageId: assistantMessageId
      });
    } catch (error) {
      await stream.send({
        type: "chunk",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      });
      await stream.send({ type: "done" });
    } finally {
      await stream.close();
    }
  }
);
