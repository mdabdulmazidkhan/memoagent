import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { mcpClient } from "./client";

interface CallToolRequest {
  name: string;
  args: Record<string, unknown>;
}

interface CallToolResponse {
  result: unknown;
}

export const callTool = api<CallToolRequest, CallToolResponse>(
  { auth: true, expose: true, method: "POST", path: "/mcp/tools/call" },
  async (req) => {
    const auth = getAuthData()!;
    
    try {
      const result = await mcpClient.callTool(req.name, req.args);
      return { result };
    } catch (error) {
      throw new Error(`Failed to call MCP tool: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);
