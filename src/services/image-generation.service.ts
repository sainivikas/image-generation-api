import { randomUUID } from "crypto";
import { config } from "../config";
import { GenerateImagePayload } from "../types/api";
import { generateImageFromGemini } from "../clients/gemini-client";
import { uploadImageToS3 } from "./storage.service";

export async function createImage(payload: GenerateImagePayload): Promise<{ jobId: string; imageUrl: string }> {
  const jobId = randomUUID();
  const width = payload.width ?? config.IMAGE_WIDTH;
  const height = payload.height ?? config.IMAGE_HEIGHT;

  const base64Image = await generateImageFromGemini({
    prompt: payload.prompt,
    style: payload.style,
    width,
    height,
    referenceImages: payload.referenceImages
  });

  const buffer = Buffer.from(base64Image, "base64");
  const key = `images/${jobId}.png`;
  const imageUrl = await uploadImageToS3(key, buffer, "image/png");

  return { jobId, imageUrl };
}
