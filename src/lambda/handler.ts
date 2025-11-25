import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { config, isDebug } from "../config";
import { createImage } from "../services/image-generation.service";

const payloadSchema = z.object({
  prompt: z.string().min(1),
  width: z.number().int().positive().max(2048).optional(),
  height: z.number().int().positive().max(2048).optional(),
  style: z.string().max(300).optional(),
  referenceImages: z
    .array(
      z.object({
        url: z.string().url(),
        description: z.string().max(256).optional(),
        mimeType: z.string().optional()
      })
    )
    .optional()
});

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-api-key"
};

function buildErrorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ status: "failed", error: message })
  };
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> => {
  const method = event.requestContext?.http?.method?.toUpperCase() ?? "POST";
  const path = event.rawPath ?? event.requestContext?.http?.path ?? "";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (method === "GET" && path.includes("/health")) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() })
    };
  }

  if (method !== "POST") {
    return buildErrorResponse(405, "Only POST /v1/images/generate is supported");
  }

  const rawApiKey = event.headers?.["x-api-key"] ?? event.headers?.["X-Api-Key"];
  if (!rawApiKey || rawApiKey !== config.API_KEY) {
    return buildErrorResponse(403, "Invalid or missing API key");
  }

  if (!event.body) {
    return buildErrorResponse(400, "Request body is required");
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return buildErrorResponse(400, "Unable to parse JSON body");
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" | ");
    return buildErrorResponse(400, `Invalid payload: ${message}`);
  }

  const createdAt = new Date().toISOString();
  const start = Date.now();

  try {
    const { jobId, imageUrl } = await createImage(parsed.data);
    const completedAt = new Date().toISOString();
    const processingTime = (Date.now() - start) / 1000;

    const response = {
      jobId,
      status: "completed",
      imageUrl,
      createdAt,
      completedAt,
      processingTime
    };

    if (isDebug) {
      console.info("Image generated", response);
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error("Image generation failed", error);
    return buildErrorResponse(502, (error as Error).message || "Image generation failed");
  }
};
