/**
 * Runware API utilities and helper functions.
 * Provides functions for API communication, video model management, and video generation polling.
 */

import { secret } from "encore.dev/config";

// API Configuration
export const DEFAULT_POLL_INTERVAL = 2;
export const DEFAULT_TIMEOUT = 300;
export const DEFAULT_API_BASE_URL = "https://api.runware.ai/v1";

const runwareApiKey = secret("RunwareApiKey");

// Video Models Information
export const VIDEO_MODELS: Record<string, string[]> = {
    "KlingAI": [
        "klingai:1@2 (KlingAI V1.0 Pro)",
        "klingai:1@1 (KlingAI V1 Standard)",
        "klingai:2@2 (KlingAI V1.5 Pro)",
        "klingai:2@1 (KlingAI V1.5 Standard)",
        "klingai:3@1 (KlingAI V1.6 Standard)",
        "klingai:3@2 (KlingAI V1.6 Pro)",
        "klingai:4@3 (KlingAI V2.1 Master)",
        "klingai:5@1 (KlingAI V2.1 Standard (I2V))",
        "klingai:5@2 (KlingAI V2.1 Pro (I2V))",
        "klingai:5@3 (KlingAI V2.0 Master)",
    ],
    "Veo": [
        "google:2@0 (Veo 2.0)",
        "google:3@0 (Veo 3.0)",
        "google:3@1 (Veo 3.0 Fast)",
    ],
    "Seedance": [
        "bytedance:2@1 (Seedance 1.0 Pro)",
        "bytedance:1@1 (Seedance 1.0 Lite)",
    ],
    "MiniMax": [
        "minimax:1@1 (MiniMax 01 Base)",
        "minimax:2@1 (MiniMax 01 Director)",
        "minimax:2@3 (MiniMax I2V 01 Live)",
        "minimax:3@1 (MiniMax 02 Hailuo)",
    ],
    "PixVerse": [
        "pixverse:1@1 (PixVerse v3.5)",
        "pixverse:1@2 (PixVerse v4)",
        "pixverse:1@3 (PixVerse v4.5)",
    ],
    "Vidu": [
        "vidu:1@0 (Vidu Q1 Classic)",
        "vidu:1@1 (Vidu Q1)",
        "vidu:1@5 (Vidu 1.5)",
        "vidu:2@0 (Vidu 2.0)",
    ],
    "Wan": [
        "runware:200@1 (Wan 2.1 1.3B)",
        "runware:200@2 (Wan 2.1 14B)",
    ],
};

// Model dimensions mapping
export const MODEL_DIMENSIONS: Record<string, { width: number; height: number }> = {
    // KlingAI Models
    "klingai:1@2": { width: 1280, height: 720 },
    "klingai:1@1": { width: 1280, height: 720 },
    "klingai:2@2": { width: 1920, height: 1080 },
    "klingai:2@1": { width: 1280, height: 720 },
    "klingai:3@1": { width: 1280, height: 720 },
    "klingai:3@2": { width: 1920, height: 1080 },
    "klingai:4@3": { width: 1280, height: 720 },
    "klingai:5@1": { width: 1280, height: 720 },
    "klingai:5@2": { width: 1920, height: 1080 },
    "klingai:5@3": { width: 1920, height: 1080 },
    
    // Veo Models
    "google:2@0": { width: 1280, height: 720 },
    "google:3@0": { width: 1280, height: 720 },
    "google:3@1": { width: 1280, height: 720 },
    
    // Seedance Models
    "bytedance:2@1": { width: 864, height: 480 },
    "bytedance:1@1": { width: 864, height: 480 },
    
    // MiniMax Models
    "minimax:1@1": { width: 1366, height: 768 },
    "minimax:2@1": { width: 1366, height: 768 },
    "minimax:2@3": { width: 1366, height: 768 },
    "minimax:3@1": { width: 1366, height: 768 },
    
    // PixVerse Models
    "pixverse:1@1": { width: 640, height: 360 },
    "pixverse:1@2": { width: 640, height: 360 },
    "pixverse:1@3": { width: 640, height: 360 },
    
    // Vidu Models
    "vidu:1@0": { width: 1920, height: 1080 },
    "vidu:1@1": { width: 1920, height: 1080 },
    "vidu:1@5": { width: 1920, height: 1080 },
    "vidu:2@0": { width: 1920, height: 1080 },
    
    // Wan Models
    "runware:200@1": { width: 853, height: 480 },
    "runware:200@2": { width: 853, height: 480 },
};

/**
 * Get the supported dimensions for a specific video model.
 */
export function getModelDimensions(modelId: string): { width: number; height: number } | undefined {
    return MODEL_DIMENSIONS[modelId];
}

/**
 * Validate if the provided dimensions are supported by the specified video model.
 */
export function validateVideoDimensions(modelId: string, width: number, height: number): [boolean, string] {
    const modelDims = getModelDimensions(modelId);
    if (!modelDims) {
        return [false, `Model '${modelId}' not found in supported video models`];
    }
    
    const expectedWidth = modelDims.width;
    const expectedHeight = modelDims.height;
    
    if (width !== expectedWidth || height !== expectedHeight) {
        return [false, `Model '${modelId}' only supports dimensions ${expectedWidth}x${expectedHeight}, but you provided ${width}x${height}`];
    }
    
    return [true, ""];
}

/**
 * Get all supported video models organized by provider.
 */
export function getSupportedVideoModels(): Record<string, string[]> {
    return VIDEO_MODELS;
}
