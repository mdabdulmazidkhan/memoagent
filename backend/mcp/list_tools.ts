import { api } from "encore.dev/api";
import { mcpClient } from "./client";

interface Tool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface ListToolsResponse {
  tools: Tool[];
  connected: boolean;
}

export const listTools = api<void, ListToolsResponse>(
  { expose: true, method: "GET", path: "/mcp/tools" },
  async () => {
    try {
      const tools = await mcpClient.getTools();
      return {
        tools,
        connected: mcpClient.isConnected()
      };
    } catch (error) {
      console.error("Error listing MCP tools:", error);
      return {
        tools: [],
        connected: false
      };
    }
  }
);
