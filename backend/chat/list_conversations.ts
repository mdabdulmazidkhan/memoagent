import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { Conversation } from "./types";

interface ListConversationsResponse {
  conversations: Conversation[];
}

export const listConversations = api<void, ListConversationsResponse>(
  { auth: true, expose: true, method: "GET", path: "/chat/conversations" },
  async () => {
    const auth = getAuthData()!;
    const rows = await db.queryAll<{
      id: string;
      user_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, user_id, title, created_at, updated_at
      FROM conversations
      WHERE user_id = ${auth.userID}
      ORDER BY updated_at DESC
    `;

    const conversations: Conversation[] = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return { conversations };
  }
);
