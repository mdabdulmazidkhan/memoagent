export interface MCPServer {
  command: string;
  args: string[];
}

export interface MCPConfig {
  mcpServers: {
    [key: string]: MCPServer;
  };
}

export const mcpConfig: MCPConfig = {
  mcpServers: {
    Activepieces: {
      command: "npx",
      args: [
        "-y",
        "mcp-remote",
        "https://cloud.activepieces.com/api/v1/mcp/NXArRv3sXRsjLywAmthd9/sse"
      ]
    }
  }
};
