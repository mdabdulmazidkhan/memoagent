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
    const tools = await mcpClient.getTools();
    const messageLower = userMessage.toLowerCase();
    
    // Check for image generation keywords
    if (messageLower.includes("image") || messageLower.includes("picture") || 
        messageLower.includes("photo") || messageLower.includes("draw")) {
      
      // Check if it's image generation from text
      if (messageLower.includes("generate") || messageLower.includes("create") || 
          messageLower.includes("make") || messageLower.includes("of")) {
        
        // Extract the prompt - remove the command words
        let prompt = userMessage;
        const prefixes = ["generate", "create", "make", "draw"];
        for (const prefix of prefixes) {
          const regex = new RegExp(`${prefix}\\s+(an?\\s+)?(image|picture|photo)\\s+(of\\s+)?`, "i");
          prompt = prompt.replace(regex, "").trim();
        }
        
        return {
          shouldUseMCP: true,
          toolName: "generateImageFromText",
          args: { 
            prompt: prompt,
            model: "runware:100@1"  // FLUX Schnell - fast and high quality
          }
        };
      }
      
      // Check for background removal
      if (messageLower.includes("background") && messageLower.includes("remove")) {
        return {
          shouldUseMCP: true,
          toolName: "removeBackground",
          args: { imageURL: "placeholder" }  // User would need to provide URL
        };
      }
      
      // Check for upscale
      if (messageLower.includes("upscale") || messageLower.includes("enhance") || messageLower.includes("improve")) {
        return {
          shouldUseMCP: true,
          toolName: "upscaleImage",
          args: { imageURL: "placeholder", upscaleFactor: 2 }
        };
      }
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

        try {
          console.log("Calling MCP tool:", mcpCheck.toolName, "with args:", mcpCheck.args);
          const toolResult = await mcpClient.callTool(mcpCheck.toolName, mcpCheck.args || {});
          console.log("MCP tool result:", JSON.stringify(toolResult));
          
          const resultMsg = `✅ Tool Result:\n${JSON.stringify(toolResult, null, 2)}`;
          fullResponse += resultMsg;
          
          await stream.send({
            type: "chunk",
            content: resultMsg
          });
        } catch (toolError) {
          console.error("MCP tool error:", toolError);
          const errorMsg = `❌ Error calling MCP tool: ${toolError instanceof Error ? toolError.message : "Unknown error"}\n\nStack: ${toolError instanceof Error ? toolError.stack : ""}`;
          fullResponse += errorMsg;
          await stream.send({
            type: "chunk",
            content: errorMsg
          });
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
