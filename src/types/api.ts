// types/api.ts

export interface ReferenceImageInput {
  url: string;
  description?: string;
  mimeType?: string;
}

// Internal helper metadata returned when reference images are downloaded/decoded
export interface ProcessedReferenceImage {
  content: string; // Base64 string
  mimeType: string;
  description?: string;
}

export interface GenerateImagePayload {
  prompt: string;
  width?: number; // Optional in API (defaults handled in service)
  height?: number;
  style?: string;
  referenceImages?: ReferenceImageInput[];
}

export interface GenerateImageResponse {
  jobId: string;
  status: "completed" | "failed";
  imageUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  processingTime?: number;
}