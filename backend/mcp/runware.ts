import { secret } from "encore.dev/config";

const runwareApiKey = secret("RunwareApiKey");

interface RunwareTask {
  taskType: string;
  taskUUID?: string;
  [key: string]: unknown;
}

interface RunwareResponse {
  data: Array<{
    taskType: string;
    taskUUID: string;
    imageURL?: string;
    imageUUID?: string;
    videoURL?: string;
    [key: string]: unknown;
  }>;
}

async function callRunwareAPI(tasks: RunwareTask[]): Promise<RunwareResponse> {
  const response = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${runwareApiKey()}`
    },
    body: JSON.stringify(tasks)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runware API error: ${response.status} - ${error}`);
  }

  return await response.json() as RunwareResponse;
}

export async function generateImageFromText(prompt: string, model: string = "runware:100@1"): Promise<string> {
  const task: RunwareTask = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt: prompt,
    model: model,
    numberResults: 1,
    height: 512,
    width: 512,
    steps: 20,
    outputType: "URL",
    outputFormat: "PNG"
  };

  const result = await callRunwareAPI([task]);
  
  if (result.data && result.data.length > 0 && result.data[0].imageURL) {
    return result.data[0].imageURL;
  }
  
  throw new Error("No image generated");
}

export async function removeBackground(imageURL: string): Promise<string> {
  const task: RunwareTask = {
    taskType: "imageBackgroundRemoval",
    taskUUID: crypto.randomUUID(),
    inputImage: imageURL,
    outputType: "URL",
    outputFormat: "PNG"
  };

  const result = await callRunwareAPI([task]);
  
  if (result.data && result.data.length > 0 && result.data[0].imageURL) {
    return result.data[0].imageURL;
  }
  
  throw new Error("No image generated");
}

export async function upscaleImage(imageURL: string, upscaleFactor: number = 2): Promise<string> {
  const task: RunwareTask = {
    taskType: "imageUpscale",
    taskUUID: crypto.randomUUID(),
    inputImage: imageURL,
    upscaleFactor: upscaleFactor,
    outputType: "URL",
    outputFormat: "PNG"
  };

  const result = await callRunwareAPI([task]);
  
  if (result.data && result.data.length > 0 && result.data[0].imageURL) {
    return result.data[0].imageURL;
  }
  
  throw new Error("No image generated");
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

class RunwareMCPClient {
  private tools: MCPTool[] = [
    {
      name: "generateImageFromText",
      description: "Generate an image from a text description",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Text description of the image to generate" },
          model: { type: "string", description: "Model AIR identifier (default: runware:100@1)" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "removeBackground",
      description: "Remove background from an image",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "URL of the image" }
        },
        required: ["imageURL"]
      }
    },
    {
      name: "upscaleImage",
      description: "Upscale an image to higher resolution",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "URL of the image" },
          upscaleFactor: { type: "number", description: "Upscale factor (2, 3, or 4)" }
        },
        required: ["imageURL"]
      }
    }
  ];

  async getTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "generateImageFromText":
        return await generateImageFromText(
          args.prompt as string, 
          args.model as string | undefined
        );
      
      case "removeBackground":
        return await removeBackground(args.imageURL as string);
      
      case "upscaleImage":
        return await upscaleImage(
          args.imageURL as string, 
          args.upscaleFactor as number | undefined
        );
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  isConnected(): boolean {
    return true;
  }
}

export const mcpClient = new RunwareMCPClient();
