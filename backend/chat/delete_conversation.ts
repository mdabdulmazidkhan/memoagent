import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface DeleteConversationRequest {
  id: string;
}

export const deleteConversation = api<DeleteConversationRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/chat/conversations/:id" },
  async (req) => {
    const auth = getAuthData()!;
    const result = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM conversations
      WHERE id = ${req.id} AND user_id = ${auth.userID}
    `;

    if (!result || result.count === 0) {
      throw APIError.notFound("conversation not found");
    }

    await db.exec`DELETE FROM conversations WHERE id = ${req.id}`;
  }
);
