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
    videoUUID?: string;
    text?: string;
    status?: string;
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

// Helper to poll async tasks
async function pollTask(taskUUID: string, maxAttempts: number = 60): Promise<RunwareResponse["data"][0]> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await callRunwareAPI([{
      taskType: "getResponse",
      taskUUID: taskUUID
    }]);
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      if (result.status === "success" || result.imageURL || result.videoURL) {
        return result;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error("Task timeout - generation took too long");
}

// 1. TEXT-TO-IMAGE
export async function generateImageFromText(params: {
  prompt: string;
  model?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  CFGScale?: number;
  seed?: number;
  numberResults?: number;
}): Promise<string[]> {
  const task: RunwareTask = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt: params.prompt,
    model: params.model || "runware:100@1",
    width: params.width || 512,
    height: params.height || 512,
    steps: params.steps || 20,
    CFGScale: params.CFGScale || 7,
    numberResults: params.numberResults || 1,
    outputType: "URL",
    outputFormat: "PNG",
    ...(params.negativePrompt && { negativePrompt: params.negativePrompt }),
    ...(params.seed && { seed: params.seed })
  };

  const result = await callRunwareAPI([task]);
  return result.data.filter(d => d.imageURL).map(d => d.imageURL!);
}

// 2. IMAGE-TO-IMAGE
export async function imageToImage(params: {
  prompt: string;
  seedImage: string;
  model?: string;
  strength?: number;
  width?: number;
  height?: number;
}): Promise<string> {
  const task: RunwareTask = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt: params.prompt,
    seedImage: params.seedImage,
    model: params.model || "runware:100@1",
    strength: params.strength || 0.7,
    width: params.width || 512,
    height: params.height || 512,
    outputType: "URL",
    outputFormat: "PNG"
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.imageURL) return result.data[0].imageURL;
  throw new Error("No image generated");
}

// 3. TEXT-TO-VIDEO
export async function generateVideoFromText(params: {
  prompt: string;
  model?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
}): Promise<string> {
  const taskUUID = crypto.randomUUID();
  const task: RunwareTask = {
    taskType: "videoInference",
    taskUUID: taskUUID,
    positivePrompt: params.prompt,
    model: params.model || "runware:501@1",  // Kling AI
    duration: params.duration || 5,
    width: params.width || 1280,
    height: params.height || 720,
    fps: params.fps || 24,
    deliveryMethod: "async",
    outputType: "URL",
    outputFormat: "MP4"
  };

  await callRunwareAPI([task]);
  const result = await pollTask(taskUUID);
  
  if (result.videoURL) return result.videoURL;
  throw new Error("No video generated");
}

// 4. IMAGE-TO-VIDEO
export async function imageToVideo(params: {
  imageURL: string;
  prompt?: string;
  model?: string;
  duration?: number;
}): Promise<string> {
  const taskUUID = crypto.randomUUID();
  const task: RunwareTask = {
    taskType: "videoInference",
    taskUUID: taskUUID,
    positivePrompt: params.prompt || "animate this image",
    model: params.model || "runware:501@1",
    duration: params.duration || 5,
    frameImages: [{
      inputImage: params.imageURL,
      frame: "first"
    }],
    deliveryMethod: "async",
    outputType: "URL",
    outputFormat: "MP4"
  };

  await callRunwareAPI([task]);
  const result = await pollTask(taskUUID);
  
  if (result.videoURL) return result.videoURL;
  throw new Error("No video generated");
}

// 5. BACKGROUND REMOVAL
export async function removeBackground(imageURL: string): Promise<string> {
  const task: RunwareTask = {
    taskType: "removeBackground",
    taskUUID: crypto.randomUUID(),
    inputImage: imageURL,
    outputType: "URL",
    outputFormat: "PNG"
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.imageURL) return result.data[0].imageURL;
  throw new Error("Failed to remove background");
}

// 6. IMAGE UPSCALE
export async function upscaleImage(imageURL: string, upscaleFactor: number = 2): Promise<string> {
  const task: RunwareTask = {
    taskType: "upscale",
    taskUUID: crypto.randomUUID(),
    inputImage: imageURL,
    upscaleFactor: upscaleFactor,
    outputType: "URL",
    outputFormat: "PNG"
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.imageURL) return result.data[0].imageURL;
  throw new Error("Failed to upscale image");
}

// 7. INPAINTING
export async function inpaintImage(params: {
  prompt: string;
  seedImage: string;
  maskImage: string;
  model?: string;
}): Promise<string> {
  const task: RunwareTask = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt: params.prompt,
    seedImage: params.seedImage,
    maskImage: params.maskImage,
    model: params.model || "runware:100@1",
    outputType: "URL",
    outputFormat: "PNG"
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.imageURL) return result.data[0].imageURL;
  throw new Error("No image generated");
}

// 8. IMAGE CAPTION
export async function captionImage(imageURL: string): Promise<string> {
  const task: RunwareTask = {
    taskType: "caption",
    taskUUID: crypto.randomUUID(),
    inputImage: imageURL
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.text) return result.data[0].text;
  throw new Error("Failed to caption image");
}

// 9. PROMPT ENHANCEMENT
export async function enhancePrompt(prompt: string): Promise<string> {
  const task: RunwareTask = {
    taskType: "promptEnhancer",
    taskUUID: crypto.randomUUID(),
    inputPrompt: prompt
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.text) return result.data[0].text;
  throw new Error("Failed to enhance prompt");
}

// 10. CONTROLNET PREPROCESS
export async function controlnetPreprocess(params: {
  imageURL: string;
  preprocessor: "canny" | "depth" | "pose" | "mlsd" | "hed" | "scribble";
}): Promise<string> {
  const task: RunwareTask = {
    taskType: "controlNetPreprocess",
    taskUUID: crypto.randomUUID(),
    inputImage: params.imageURL,
    preprocessor: params.preprocessor,
    outputType: "URL"
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.imageURL) return result.data[0].imageURL;
  throw new Error("Failed to preprocess image");
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
      description: "Generate images from text descriptions with customizable parameters",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Text description of the image" },
          model: { type: "string", description: "Model AIR (e.g., runware:100@1 for FLUX)" },
          negativePrompt: { type: "string", description: "What to avoid" },
          width: { type: "number", description: "Width (128-2048, divisible by 64)" },
          height: { type: "number", description: "Height (128-2048, divisible by 64)" },
          steps: { type: "number", description: "Steps (1-100)" },
          CFGScale: { type: "number", description: "Guidance scale (0-50)" },
          seed: { type: "number", description: "Seed for reproducibility" },
          numberResults: { type: "number", description: "Number of images (1-20)" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "imageToImage",
      description: "Transform images based on text prompts",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Transformation description" },
          seedImage: { type: "string", description: "Source image URL" },
          model: { type: "string", description: "Model AIR" },
          strength: { type: "number", description: "Transformation strength (0-1)" },
          width: { type: "number", description: "Output width" },
          height: { type: "number", description: "Output height" }
        },
        required: ["prompt", "seedImage"]
      }
    },
    {
      name: "generateVideoFromText",
      description: "Generate videos from text descriptions",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Video description" },
          model: { type: "string", description: "Model AIR (e.g., runware:501@1 for Kling)" },
          duration: { type: "number", description: "Duration in seconds (1-10)" },
          width: { type: "number", description: "Width (256-1920)" },
          height: { type: "number", description: "Height (256-1920)" },
          fps: { type: "number", description: "Frame rate (15-60)" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "imageToVideo",
      description: "Animate images into videos",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Image to animate" },
          prompt: { type: "string", description: "Animation description" },
          model: { type: "string", description: "Model AIR" },
          duration: { type: "number", description: "Duration in seconds" }
        },
        required: ["imageURL"]
      }
    },
    {
      name: "removeBackground",
      description: "Remove background from images",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Image URL" }
        },
        required: ["imageURL"]
      }
    },
    {
      name: "upscaleImage",
      description: "Upscale images to higher resolution",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Image URL" },
          upscaleFactor: { type: "number", description: "Scale factor (2, 3, or 4)" }
        },
        required: ["imageURL"]
      }
    },
    {
      name: "inpaintImage",
      description: "Edit specific parts of images using masks",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "What to paint" },
          seedImage: { type: "string", description: "Original image" },
          maskImage: { type: "string", description: "Mask (white = edit area)" },
          model: { type: "string", description: "Model AIR" }
        },
        required: ["prompt", "seedImage", "maskImage"]
      }
    },
    {
      name: "captionImage",
      description: "Generate captions for images",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Image to caption" }
        },
        required: ["imageURL"]
      }
    },
    {
      name: "enhancePrompt",
      description: "Enhance and improve text prompts",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Original prompt" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "controlnetPreprocess",
      description: "Preprocess images for ControlNet (edges, depth, pose, etc)",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Image to preprocess" },
          preprocessor: { type: "string", description: "Type: canny, depth, pose, mlsd, hed, scribble" }
        },
        required: ["imageURL", "preprocessor"]
      }
    }
  ];

  async getTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "generateImageFromText":
        return await generateImageFromText(args as Parameters<typeof generateImageFromText>[0]);
      
      case "imageToImage":
        return await imageToImage(args as Parameters<typeof imageToImage>[0]);
      
      case "generateVideoFromText":
        return await generateVideoFromText(args as Parameters<typeof generateVideoFromText>[0]);
      
      case "imageToVideo":
        return await imageToVideo(args as Parameters<typeof imageToVideo>[0]);
      
      case "removeBackground":
        return await removeBackground(args.imageURL as string);
      
      case "upscaleImage":
        return await upscaleImage(args.imageURL as string, args.upscaleFactor as number | undefined);
      
      case "inpaintImage":
        return await inpaintImage(args as Parameters<typeof inpaintImage>[0]);
      
      case "captionImage":
        return await captionImage(args.imageURL as string);
      
      case "enhancePrompt":
        return await enhancePrompt(args.prompt as string);
      
      case "controlnetPreprocess":
        return await controlnetPreprocess(args as Parameters<typeof controlnetPreprocess>[0]);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  isConnected(): boolean {
    return true;
  }
}

export const mcpClient = new RunwareMCPClient();