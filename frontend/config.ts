// Configuration for the chatbot

export const config = {
  // User ID for demo purposes
  // TODO: Replace with actual user ID from authentication
  userId: "demo-user",

  // OpenRouter model to use
  model: "openai/gpt-4o-mini",

  // MCP server configuration
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
