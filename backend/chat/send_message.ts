import { api, StreamOut } from "encore.dev/api";
import { randomUUID } from "crypto";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { streamChatCompletion } from "./openrouter";
import type { OpenRouterMessage } from "./openrouter";
import { mcpClient } from "../mcp/runware";

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

async function checkMCPTools(userMessage: string): Promise<{ shouldUseMCP: boolean; toolName?: string; args?: Record<string, unknown> }> {
  try {
    const messageLower = userMessage.toLowerCase();
    
    // VIDEO GENERATION
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
            model: "google:3@1",  // Veo 3.0 Fast (default T2V)
            width: 1280,
            height: 720,
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

    const messages: OpenRouterMessage[] = history.map(msg => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content
    }));

    const assistantMessageId = randomUUID();
    let fullResponse = "";

    try {
      const mcpCheck = await checkMCPTools(req.content);
      
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
          videoInference: ["google:3@1", "klingai:1@2", "minimax:3@1"],
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
            toolResult = await mcpClient.callTool(mcpCheck.toolName, currentArgs || {});
            console.log("MCP tool result:", JSON.stringify(toolResult));
            
            const resultMsg = `✅ Tool Result:\n${JSON.stringify(toolResult, null, 2)}`;
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
