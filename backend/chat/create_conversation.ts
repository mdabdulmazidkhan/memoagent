import { api } from "encore.dev/api";
import { randomUUID } from "crypto";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { Conversation } from "./types";

interface CreateConversationRequest {
  title?: string;
}

export const createConversation = api<CreateConversationRequest, Conversation>(
  { auth: true, expose: true, method: "POST", path: "/chat/conversations" },
  async (req) => {
    const auth = getAuthData()!;
    const id = randomUUID();
    const title = req.title || "New Chat";
    const now = new Date();

    await db.exec`
      INSERT INTO conversations (id, user_id, title, created_at, updated_at)
      VALUES (${id}, ${auth.userID}, ${title}, ${now}, ${now})
    `;

    return {
      id,
      userId: auth.userID,
      title,
      createdAt: now,
      updatedAt: now
    };
  }
);
