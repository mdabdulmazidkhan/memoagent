import { api, StreamOut } from "encore.dev/api";
import { randomUUID } from "crypto";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { streamChatCompletion } from "./openrouter";
import type { OpenRouterMessage } from "./openrouter";
import { mcpClient } from "../mcp/client";

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
    
    for (const tool of tools) {
      const toolNameLower = tool.name.toLowerCase();
      const messageLower = userMessage.toLowerCase();
      
      if (messageLower.includes(toolNameLower) || 
          (tool.description && messageLower.includes(tool.description.toLowerCase().split(' ')[0]))) {
        return {
          shouldUseMCP: true,
          toolName: tool.name,
          args: {}
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
      
      if (mcpCheck.shouldUseMCP && mcpCheck.toolName) {
        await stream.send({
          type: "chunk",
          content: `Using MCP tool: ${mcpCheck.toolName}...\n\n`
        });

        try {
          const toolResult = await mcpClient.callTool(mcpCheck.toolName, mcpCheck.args || {});
          fullResponse = `Tool: ${mcpCheck.toolName}\n\nResult:\n${JSON.stringify(toolResult, null, 2)}`;
          
          await stream.send({
            type: "chunk",
            content: fullResponse
          });
        } catch (toolError) {
          fullResponse = `Error calling MCP tool: ${toolError instanceof Error ? toolError.message : "Unknown error"}`;
          await stream.send({
            type: "chunk",
            content: fullResponse
          });
        }
      } else {
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
