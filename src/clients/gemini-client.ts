// clients/gemini-client.ts

import axios from "axios";
import path from "path";
import { Buffer } from "buffer";
import { config, isDebug } from "../config";
import { ReferenceImageInput, ProcessedReferenceImage } from "../types/api";

const MAX_REFERENCE_IMAGES = 1;
const DEFAULT_MODEL = "gemini-2.5-flash-image";
const API_VERSION = "v1beta";

const extensionToMime: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function detectMimeType(reference: string): string {
  if (reference.startsWith("data:")) {
    const match = reference.match(/^data:(.*?);/);
    if (match) return match[1];
  }
  const ext = path.extname(reference).toLowerCase();
  return extensionToMime[ext] ?? "image/png";
}

function extractBase64FromDataUrl(reference: string): string | null {
  if (!reference.startsWith("data:")) {
    return null;
  }
  const [, base64] = reference.split(",", 2);
  return base64 ?? null;
}

async function toBase64Image(reference: ReferenceImageInput): Promise<ProcessedReferenceImage> {
  const base64FromData = extractBase64FromDataUrl(reference.url);
  const mimeType = reference.mimeType ?? detectMimeType(reference.url);

  if (base64FromData) {
    return { content: base64FromData, mimeType, description: reference.description };
  }

  const response = await axios.get<ArrayBuffer>(reference.url, {
    responseType: "arraybuffer",
    timeout: 15_000
  });

  return {
    content: Buffer.from(response.data).toString("base64"),
    mimeType,
    description: reference.description
  };
}

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio === 1) return "1:1";
  if (ratio > 1.7) return "16:9";
  if (ratio > 1.3) return "4:3";
  if (ratio < 0.6) return "9:16";
  if (ratio < 0.8) return "3:4";
  return "1:1";
}

export type GenerateImageInput = {
  prompt: string;
  width: number;
  height: number;
  style?: string;
  referenceImages?: ReferenceImageInput[];
};

function buildContents(prompt: string, reference?: ProcessedReferenceImage): Array<Record<string, any>> {
  const parts: Array<Record<string, any>> = [{ text: prompt }];
  if (reference) {
    parts.push({
      inlineData: {
        mimeType: reference.mimeType,
        data: reference.content
      },
      description: reference.description
    });
  }
  return [
    {
      parts
    }
  ];
}

function getBase64ImageFromResponse(response: any): string | null {
  const candidate = response?.candidates?.[0];
  const parts: Array<Record<string, any>> = candidate?.content?.parts ?? [];
  for (const part of parts) {
    const inlineData = part.inlineData;
    if (inlineData?.data) {
      return inlineData.data;
    }
  }
  return null;
}

export async function generateImageFromGemini(input: GenerateImageInput): Promise<string> {
  const modelId = config.GEMINI_MODEL ?? DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${modelId}:generateContent?key=${config.GEMINI_API_KEY}`;
  const promptText = input.style ? `${input.prompt}. Style: ${input.style}` : input.prompt;

  let referenceImage: ProcessedReferenceImage | undefined;
  if (input.referenceImages?.length) {
    try {
      const processedReferences = await Promise.all(
        input.referenceImages.slice(0, MAX_REFERENCE_IMAGES).map(toBase64Image)
      );
      referenceImage = processedReferences[0];
    } catch (error) {
      console.warn("Failed to process reference images, continuing with text-only generation", error);
    }
  }

  const body = {
    contents: buildContents(promptText, referenceImage),
    generationConfig: {
      imageConfig: {
        aspectRatio: getAspectRatio(input.width, input.height)
      }
    }
  };

  if (isDebug) {
    console.debug("Calling Gemini API", { endpoint, body: JSON.stringify(body, null, 2) });
  }

  try {
    const response = await axios.post(endpoint, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 60_000
    });

    const base64Image = getBase64ImageFromResponse(response.data);
    if (!base64Image) {
      console.error("Gemini response did not include image data", JSON.stringify(response.data, null, 2));
      throw new Error("Gemini returned no image data.");
    }

    return base64Image;
  } catch (error: any) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error("Gemini API Error:", errMsg);
    throw new Error(`Gemini API Failed: ${errMsg}`);
  }
}