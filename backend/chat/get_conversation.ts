import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { ConversationWithMessages, Message } from "./types";

interface GetConversationRequest {
  id: string;
}

export const getConversation = api<GetConversationRequest, ConversationWithMessages>(
  { auth: true, expose: true, method: "GET", path: "/chat/conversations/:id" },
  async (req) => {
    const auth = getAuthData()!;
    const conversation = await db.queryRow<{
      id: string;
      user_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, user_id, title, created_at, updated_at
      FROM conversations
      WHERE id = ${req.id} AND user_id = ${auth.userID}
    `;

    if (!conversation) {
      throw APIError.notFound("conversation not found");
    }

    const messageRows = await db.queryAll<{
      id: string;
      conversation_id: string;
      role: string;
      content: string;
      created_at: Date;
    }>`
      SELECT id, conversation_id, role, content, created_at
      FROM messages
      WHERE conversation_id = ${req.id}
      ORDER BY created_at ASC
    `;

    const messages: Message[] = messageRows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as "user" | "assistant" | "system",
      content: row.content,
      createdAt: row.created_at
    }));

    return {
      id: conversation.id,
      userId: conversation.user_id,
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messages
    };
  }
);
