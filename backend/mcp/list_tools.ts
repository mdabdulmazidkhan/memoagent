import { api } from "encore.dev/api";

interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

interface ListToolsResponse {
  tools: Tool[];
}

// Lists available MCP tools
export const listTools = api<void, ListToolsResponse>(
  { expose: true, method: "GET", path: "/mcp/tools" },
  async () => {
    // TODO: Implement actual MCP client connection
    // This would require the MCP SDK and WebSocket/SSE connection
    // For now, returning empty array as placeholder
    return {
      tools: []
    };
  }
);
