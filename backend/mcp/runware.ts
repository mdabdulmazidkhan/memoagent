import { secret } from "encore.dev/config";
import { 
  MODEL_DIMENSIONS, 
  validateVideoDimensions, 
  getSupportedVideoModels,
  pollVideoCompletion 
} from "./runware_utils";

const runwareApiKey = secret("RunwareApiKey");
const DEFAULT_API_BASE_URL = "https://api.runware.ai/v1";

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
  errors?: Array<{
    message: string;
    [key: string]: unknown;
  }>;
}

async function callRunwareAPI(tasks: RunwareTask[]): Promise<RunwareResponse> {
  const response = await fetch(DEFAULT_API_BASE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${runwareApiKey()}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip, deflate, br, zstd"
    },
    body: JSON.stringify(tasks)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runware API error: ${response.status} - ${error}`);
  }

  const result = await response.json() as RunwareResponse;
  
  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }
  
  return result;
}

async function pollTaskCompletion(taskUUID: string, maxAttempts: number = 60): Promise<RunwareResponse["data"][0]> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await callRunwareAPI([{
      taskType: "getResponse",
      taskUUID: taskUUID
    }]);
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      if (result.status === "success" || result.imageURL || result.videoURL || result.status === "failed") {
        return result;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error("Task timeout - generation took too long");
}

// 1. IMAGE INFERENCE (Full-featured)
export async function imageInference(params: {
  prompt: string;
  model?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  CFGScale?: number;
  seed?: number;
  numberResults?: number;
  seedImage?: string;
  strength?: number;
  maskImage?: string;
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
    ...(params.seed && { seed: params.seed }),
    ...(params.seedImage && { seedImage: params.seedImage }),
    ...(params.strength && { strength: params.strength }),
    ...(params.maskImage && { maskImage: params.maskImage })
  };

  const result = await callRunwareAPI([task]);
  return result.data.filter(d => d.imageURL).map(d => d.imageURL!);
}

// 2. PHOTOMAKER (Subject Personalization)
export async function photoMaker(params: {
  prompt: string;
  inputImages: string[];
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
}): Promise<string> {
  const task: RunwareTask = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt: params.prompt,
    model: params.model || "civitai:139562@344487",
    width: params.width || 512,
    height: params.height || 512,
    steps: params.steps || 20,
    photoMaker: {
      inputImages: params.inputImages,
      mode: "style"
    },
    outputType: "URL",
    outputFormat: "PNG"
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.imageURL) return result.data[0].imageURL;
  throw new Error("No image generated");
}

// 3. IMAGE UPSCALE
export async function imageUpscale(imageURL: string, upscaleFactor: number = 2): Promise<string> {
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

// 4. BACKGROUND REMOVAL
export async function imageBackgroundRemoval(imageURL: string): Promise<string> {
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

// 5. IMAGE CAPTION
export async function imageCaption(imageURL: string): Promise<string> {
  const task: RunwareTask = {
    taskType: "caption",
    taskUUID: crypto.randomUUID(),
    inputImage: imageURL
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.text) return result.data[0].text;
  throw new Error("Failed to caption image");
}

// 6. IMAGE MASKING
export async function imageMasking(params: {
  imageURL: string;
  prompt: string;
}): Promise<string> {
  const task: RunwareTask = {
    taskType: "imageMasking",
    taskUUID: crypto.randomUUID(),
    inputImage: params.imageURL,
    prompt: params.prompt,
    outputType: "URL"
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.imageURL) return result.data[0].imageURL;
  throw new Error("Failed to create mask");
}

// 7. VIDEO INFERENCE
export async function videoInference(params: {
  prompt: string;
  model?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  frameImages?: Array<{ inputImage: string; frame: string | number }>;
}): Promise<string> {
  const taskUUID = crypto.randomUUID();
  
  // Smart model selection
  const isI2V = params.frameImages && params.frameImages.length > 0;
  const defaultModel = isI2V ? "klingai:5@2" : "google:3@1";
  const model = params.model || defaultModel;
  
  // Get model dimensions
  const modelDims = MODEL_DIMENSIONS[model];
  if (!modelDims) {
    throw new Error(`Model '${model}' not found in supported video models`);
  }
  
  const width = params.width || modelDims.width;
  const height = params.height || modelDims.height;
  
  // Validate dimensions
  const [isValid, errorMsg] = validateVideoDimensions(model, width, height);
  if (!isValid) {
    throw new Error(errorMsg);
  }
  
  const task: RunwareTask = {
    taskType: "videoInference",
    taskUUID: taskUUID,
    positivePrompt: params.prompt,
    model: model,
    duration: params.duration || 5,
    width: width,
    height: height,
    fps: params.fps || 24,
    deliveryMethod: "async",
    outputType: "URL",
    outputFormat: "MP4",
    ...(params.frameImages && { frameImages: params.frameImages })
  };

  await callRunwareAPI([task]);
  const result = await pollTaskCompletion(taskUUID, 150); // 5 min timeout for videos
  
  if (result.videoURL) return result.videoURL;
  if (result.status === "failed") throw new Error("Video generation failed");
  throw new Error("No video generated");
}

// 8. IMAGE UPLOAD
export async function imageUpload(inputImage: string): Promise<string> {
  const task: RunwareTask = {
    taskType: "imageUpload",
    taskUUID: crypto.randomUUID(),
    inputImage: inputImage
  };

  const result = await callRunwareAPI([task]);
  if (result.data[0]?.imageUUID) return result.data[0].imageUUID;
  throw new Error("Failed to upload image");
}

// 9. MODEL SEARCH
export async function modelSearch(query: string): Promise<any[]> {
  // This would use Runware's model search API
  // For now, return video models matching the query
  const allModels = getSupportedVideoModels();
  const results: any[] = [];
  
  const queryLower = query.toLowerCase();
  for (const [provider, models] of Object.entries(allModels)) {
    for (const model of models) {
      if (model.toLowerCase().includes(queryLower)) {
        results.push({ provider, model });
      }
    }
  }
  
  return results;
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
      name: "imageInference",
      description: "Full-featured image generation with support for text-to-image, image-to-image, and inpainting",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Text description of the image" },
          model: { type: "string", description: "Model AIR (default: runware:100@1)" },
          negativePrompt: { type: "string", description: "What to avoid" },
          width: { type: "number", description: "Width (128-2048, divisible by 64)" },
          height: { type: "number", description: "Height (128-2048, divisible by 64)" },
          steps: { type: "number", description: "Steps (1-100)" },
          CFGScale: { type: "number", description: "Guidance scale (0-50)" },
          seed: { type: "number", description: "Seed for reproducibility" },
          numberResults: { type: "number", description: "Number of images (1-20)" },
          seedImage: { type: "string", description: "Source image for i2i/inpainting" },
          strength: { type: "number", description: "Transformation strength (0-1)" },
          maskImage: { type: "string", description: "Mask image for inpainting" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "photoMaker",
      description: "Subject personalization with PhotoMaker technology",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Description with subject" },
          inputImages: { type: "array", description: "Reference images of subject", items: { type: "string" } },
          model: { type: "string", description: "Model AIR (default: civitai:139562@344487)" },
          width: { type: "number", description: "Output width" },
          height: { type: "number", description: "Output height" },
          steps: { type: "number", description: "Generation steps" }
        },
        required: ["prompt", "inputImages"]
      }
    },
    {
      name: "imageUpscale",
      description: "High-quality image resolution enhancement",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Image to upscale" },
          upscaleFactor: { type: "number", description: "Scale factor (2, 3, or 4)" }
        },
        required: ["imageURL"]
      }
    },
    {
      name: "imageBackgroundRemoval",
      description: "Background removal with AI models",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Image URL" }
        },
        required: ["imageURL"]
      }
    },
    {
      name: "imageCaption",
      description: "AI-powered image description generation",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Image to caption" }
        },
        required: ["imageURL"]
      }
    },
    {
      name: "imageMasking",
      description: "Automatic mask generation for objects in images",
      inputSchema: {
        type: "object",
        properties: {
          imageURL: { type: "string", description: "Source image" },
          prompt: { type: "string", description: "Object to mask (e.g., 'person', 'face')" }
        },
        required: ["imageURL", "prompt"]
      }
    },
    {
      name: "videoInference",
      description: "Text-to-video and image-to-video generation with automatic model selection",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Video description" },
          model: { type: "string", description: "Model AIR (auto-selected if not provided)" },
          duration: { type: "number", description: "Duration in seconds (1-10)" },
          width: { type: "number", description: "Width (auto-set based on model)" },
          height: { type: "number", description: "Height (auto-set based on model)" },
          fps: { type: "number", description: "Frame rate (15-60)" },
          frameImages: { type: "array", description: "Images for I2V", items: { type: "object" } }
        },
        required: ["prompt"]
      }
    },
    {
      name: "imageUpload",
      description: "Upload local images to get Runware UUIDs",
      inputSchema: {
        type: "object",
        properties: {
          inputImage: { type: "string", description: "Image file path or URL" }
        },
        required: ["inputImage"]
      }
    },
    {
      name: "modelSearch",
      description: "Search and discover AI models on the platform",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        },
        required: ["query"]
      }
    },
    {
      name: "listVideoModels",
      description: "List all supported video models organized by provider",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    }
  ];

  async getTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "imageInference":
        return await imageInference(args as Parameters<typeof imageInference>[0]);
      
      case "photoMaker":
        return await photoMaker(args as Parameters<typeof photoMaker>[0]);
      
      case "imageUpscale":
        return await imageUpscale(args.imageURL as string, args.upscaleFactor as number | undefined);
      
      case "imageBackgroundRemoval":
        return await imageBackgroundRemoval(args.imageURL as string);
      
      case "imageCaption":
        return await imageCaption(args.imageURL as string);
      
      case "imageMasking":
        return await imageMasking(args as Parameters<typeof imageMasking>[0]);
      
      case "videoInference":
        return await videoInference(args as Parameters<typeof videoInference>[0]);
      
      case "imageUpload":
        return await imageUpload(args.inputImage as string);
      
      case "modelSearch":
        return await modelSearch(args.query as string);
      
      case "listVideoModels":
        return getSupportedVideoModels();
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  isConnected(): boolean {
    return true;
  }
}

export const mcpClient = new RunwareMCPClient();
