import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

class MCPClientManager {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private tools: MCPTool[] = [];
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    try {
      const mcpUrl = "https://cloud.activepieces.com/api/v1/mcp/NXArRv3sXRsjLywAmthd9/sse";
      
      this.transport = new SSEClientTransport(new URL(mcpUrl));
      this.client = new Client({
        name: "ai-chatbot",
        version: "1.0.0"
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);
      this.connected = true;

      const response = await this.client.listTools();
      this.tools = response.tools || [];
    } catch (error) {
      console.error("Failed to connect to MCP server:", error);
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.connected = false;
      this.tools = [];
    }
  }

  async getTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      await this.connect();
    }
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const response = await this.client.callTool({ name, arguments: args });
    return response;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const mcpClient = new MCPClientManager();
