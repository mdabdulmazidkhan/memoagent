import { secret } from "encore.dev/config";

const memoriesApiKey = secret("MemoriesApiKey");
const BASE_URL = "https://api.memories.ai/serve/api/v1";

interface MemoriesResponse {
  code: string;
  msg: string;
  data: unknown;
  success?: boolean;
  failed?: boolean;
}

interface VideoUploadResponse {
  videoNo: string;
  videoName: string;
  videoStatus: string;
  uploadTime: string;
}

interface ChatRefItem {
  videoNo: string;
  startTime: number;
  endTime?: number;
  type: string;
  text?: string;
}

interface ChatRef {
  video: {
    video_no: string;
    video_name: string;
    duration: string;
  };
  refItems: ChatRefItem[];
}

interface TranscriptionSegment {
  index: number;
  content: string;
  startTime: string;
  endTime: string;
}

interface SummaryItem {
  title: string;
  description: string;
  start: string;
}

async function callMemoriesAPI(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown> | FormData,
  params?: Record<string, string>
): Promise<MemoriesResponse> {
  const apiKey = memoriesApiKey();
  
  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  }

  console.log(`[Memories.ai] ${method} ${url}`);

  const headers: Record<string, string> = {
    Authorization: apiKey,
  };

  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Memories.ai] Error ${response.status}:`, errorText);
    throw new Error(`Memories.ai API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as MemoriesResponse;
  console.log(`[Memories.ai] Response:`, JSON.stringify(result, null, 2));

  if (result.code !== "0000" && result.failed) {
    throw new Error(`Memories.ai error: ${result.msg}`);
  }

  return result;
}

export async function uploadVideoFile(formData: FormData): Promise<VideoUploadResponse> {
  console.log(`[Memories.ai] Uploading video file`);

  const apiKey = memoriesApiKey();
  const url = `${BASE_URL}/upload`;

  console.log(`[Memories.ai] POST ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Memories.ai] Error ${response.status}:`, errorText);
    throw new Error(`Memories.ai API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as MemoriesResponse;
  console.log(`[Memories.ai] Response:`, JSON.stringify(result, null, 2));

  if (result.code !== "0000" && result.failed) {
    throw new Error(`Memories.ai error: ${result.msg}`);
  }

  return result.data as VideoUploadResponse;
}

export async function uploadVideoFromURL(params: {
  url: string;
  uniqueId?: string;
  callback?: string;
  datetimeTaken?: string;
  cameraModel?: string;
  latitude?: string;
  longitude?: string;
  tags?: string[];
  retainOriginalVideo?: boolean;
  videoTranscriptionPrompt?: string;
}): Promise<VideoUploadResponse> {
  console.log(`[Memories.ai] Uploading video from URL: ${params.url}`);

  const body = {
    url: params.url,
    unique_id: params.uniqueId || "default",
    ...(params.callback && { callback: params.callback }),
    ...(params.datetimeTaken && { datetime_taken: params.datetimeTaken }),
    ...(params.cameraModel && { camera_model: params.cameraModel }),
    ...(params.latitude && { latitude: params.latitude }),
    ...(params.longitude && { longitude: params.longitude }),
    ...(params.tags && { tags: params.tags }),
    ...(params.retainOriginalVideo !== undefined && { retain_original_video: params.retainOriginalVideo }),
    ...(params.videoTranscriptionPrompt && { video_transcription_prompt: params.videoTranscriptionPrompt }),
  };

  const response = await callMemoriesAPI("/upload_url", "POST", body);
  return response.data as VideoUploadResponse;
}

export async function uploadVideoFromPlatform(params: {
  videoUrls: string[];
  uniqueId?: string;
  callbackUrl?: string;
  quality?: number;
  isPublic?: boolean;
}): Promise<{ taskId: string }> {
  console.log(`[Memories.ai] Uploading ${params.videoUrls.length} videos from platform`);

  const body = {
    video_urls: params.videoUrls,
    ...(params.callbackUrl && { callback_url: params.callbackUrl }),
    ...(params.quality && { quality: params.quality }),
  };

  if (!params.isPublic) {
    (body as Record<string, unknown>).unique_id = params.uniqueId || "default";
  }

  const endpoint = params.isPublic ? "/scraper_url_public" : "/scraper_url";
  const response = await callMemoriesAPI(endpoint, "POST", body);

  return response.data as { taskId: string };
}

export async function chatWithVideos(params: {
  videoNos: string[];
  prompt: string;
  sessionId?: string;
  uniqueId?: string;
}): Promise<string> {
  console.log(`[Memories.ai] Chatting with ${params.videoNos.length} videos`);

  const body = {
    video_nos: params.videoNos,
    prompt: params.prompt,
    session_id: params.sessionId || "",
    unique_id: params.uniqueId || "default",
  };

  const response = await callMemoriesAPI("/chat", "POST", body);
  const data = response.data as { content?: string; role?: string };

  if (data && typeof data === "object" && "content" in data) {
    return data.content as string;
  }

  return JSON.stringify(data);
}

export async function videoMarketerChat(params: {
  prompt: string;
  sessionId?: string;
  uniqueId?: string;
  type?: "TIKTOK" | "YOUTUBE" | "INSTAGRAM";
}): Promise<string> {
  console.log(`[Memories.ai] Video marketer chat: ${params.prompt}`);

  const body = {
    prompt: params.prompt,
    session_id: params.sessionId || "",
    unique_id: params.uniqueId || "default",
    type: params.type || "TIKTOK",
  };

  const response = await callMemoriesAPI("/marketer_chat", "POST", body);
  const data = response.data as { content?: string; role?: string };

  if (data && typeof data === "object" && "content" in data) {
    return data.content as string;
  }

  return JSON.stringify(data);
}

export async function chatWithPersonalMedia(params: {
  prompt: string;
  sessionId?: string;
  uniqueId?: string;
}): Promise<string> {
  console.log(`[Memories.ai] Chat with personal media: ${params.prompt}`);

  const body = {
    prompt: params.prompt,
    session_id: params.sessionId || "",
    unique_id: params.uniqueId || "default",
  };

  const response = await callMemoriesAPI("/chat_personal", "POST", body);
  const data = response.data as { content?: string; role?: string };

  if (data && typeof data === "object" && "content" in data) {
    return data.content as string;
  }

  return JSON.stringify(data);
}

export async function getVideoTranscription(params: {
  videoNo: string;
  uniqueId?: string;
}): Promise<TranscriptionSegment[]> {
  console.log(`[Memories.ai] Getting video transcription for: ${params.videoNo}`);

  const response = await callMemoriesAPI(
    "/get_video_transcription",
    "GET",
    undefined,
    {
      video_no: params.videoNo,
      unique_id: params.uniqueId || "default",
    }
  );

  const data = response.data as { transcriptions?: TranscriptionSegment[] };
  return data.transcriptions || [];
}

export async function getAudioTranscription(params: {
  videoNo: string;
  uniqueId?: string;
}): Promise<TranscriptionSegment[]> {
  console.log(`[Memories.ai] Getting audio transcription for: ${params.videoNo}`);

  const response = await callMemoriesAPI(
    "/get_audio_transcription",
    "GET",
    undefined,
    {
      video_no: params.videoNo,
      unique_id: params.uniqueId || "default",
    }
  );

  const data = response.data as { transcriptions?: TranscriptionSegment[] };
  return data.transcriptions || [];
}

export async function generateSummary(params: {
  videoNo: string;
  type: "CHAPTER" | "TOPIC";
  uniqueId?: string;
}): Promise<{ summary: string; items: SummaryItem[] }> {
  console.log(`[Memories.ai] Generating ${params.type} summary for: ${params.videoNo}`);

  const response = await callMemoriesAPI(
    "/generate_summary",
    "GET",
    undefined,
    {
      video_no: params.videoNo,
      type: params.type,
      unique_id: params.uniqueId || "default",
    }
  );

  const data = response.data as { summary: string; items: SummaryItem[] };
  return data;
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

class MemoriesAIMCPClient {
  private tools: MCPTool[] = [
    {
      name: "uploadVideoFile",
      description: "Upload a video file directly from the user's device",
      inputSchema: {
        type: "object",
        properties: {
          formData: { type: "object", description: "FormData with video file" },
        },
        required: ["formData"],
      },
    },
    {
      name: "uploadVideoFromURL",
      description: "Upload a video from a direct streaming URL (mp4, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Direct video URL" },
          uniqueId: { type: "string", description: "User/workspace identifier" },
          videoTranscriptionPrompt: { type: "string", description: "Custom prompt for video analysis" },
        },
        required: ["url"],
      },
    },
    {
      name: "uploadVideoFromPlatform",
      description: "Upload videos from TikTok, YouTube, or Instagram URLs",
      inputSchema: {
        type: "object",
        properties: {
          videoUrls: { type: "array", items: { type: "string" }, description: "Platform video URLs" },
          uniqueId: { type: "string", description: "User/workspace identifier" },
          quality: { type: "number", description: "Video quality (480, 720, 1080)" },
        },
        required: ["videoUrls"],
      },
    },
    {
      name: "chatWithVideos",
      description: "Ask questions about uploaded videos using their video IDs",
      inputSchema: {
        type: "object",
        properties: {
          videoNos: { type: "array", items: { type: "string" }, description: "Video IDs" },
          prompt: { type: "string", description: "Question or task" },
          uniqueId: { type: "string", description: "User/workspace identifier" },
        },
        required: ["videoNos", "prompt"],
      },
    },
    {
      name: "videoMarketerChat",
      description: "Chat with 1M+ public TikTok videos database for market research",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Market research query" },
          type: { type: "string", enum: ["TIKTOK", "YOUTUBE", "INSTAGRAM"], description: "Platform" },
          uniqueId: { type: "string", description: "User/workspace identifier" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "chatWithPersonalMedia",
      description: "Ask questions about all your uploaded videos using semantic search",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Natural language question" },
          uniqueId: { type: "string", description: "User/workspace identifier" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "getVideoTranscription",
      description: "Get full video transcription (visual + audio)",
      inputSchema: {
        type: "object",
        properties: {
          videoNo: { type: "string", description: "Video ID" },
          uniqueId: { type: "string", description: "User/workspace identifier" },
        },
        required: ["videoNo"],
      },
    },
    {
      name: "getAudioTranscription",
      description: "Get audio-only transcription from video",
      inputSchema: {
        type: "object",
        properties: {
          videoNo: { type: "string", description: "Video ID" },
          uniqueId: { type: "string", description: "User/workspace identifier" },
        },
        required: ["videoNo"],
      },
    },
    {
      name: "generateSummary",
      description: "Generate chapter or topic summary for a video",
      inputSchema: {
        type: "object",
        properties: {
          videoNo: { type: "string", description: "Video ID" },
          type: { type: "string", enum: ["CHAPTER", "TOPIC"], description: "Summary type" },
          uniqueId: { type: "string", description: "User/workspace identifier" },
        },
        required: ["videoNo", "type"],
      },
    },
  ];

  async getTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "uploadVideoFile":
        return await uploadVideoFile(args.formData as FormData);

      case "uploadVideoFromURL":
        return await uploadVideoFromURL(args as Parameters<typeof uploadVideoFromURL>[0]);

      case "uploadVideoFromPlatform":
        return await uploadVideoFromPlatform(args as Parameters<typeof uploadVideoFromPlatform>[0]);

      case "chatWithVideos":
        return await chatWithVideos(args as Parameters<typeof chatWithVideos>[0]);

      case "videoMarketerChat":
        return await videoMarketerChat(args as Parameters<typeof videoMarketerChat>[0]);

      case "chatWithPersonalMedia":
        return await chatWithPersonalMedia(args as Parameters<typeof chatWithPersonalMedia>[0]);

      case "getVideoTranscription":
        return await getVideoTranscription(args as Parameters<typeof getVideoTranscription>[0]);

      case "getAudioTranscription":
        return await getAudioTranscription(args as Parameters<typeof getAudioTranscription>[0]);

      case "generateSummary":
        return await generateSummary(args as Parameters<typeof generateSummary>[0]);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  isConnected(): boolean {
    return true;
  }
}

export const memoriesClient = new MemoriesAIMCPClient();
