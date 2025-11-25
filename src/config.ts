import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "Gemini API key is required"),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash-image"),
  AWS_REGION: z.string().default("us-east-1"),
  IMAGES_BUCKET: z.string().min(1, "Images bucket name is required"),
  API_KEY: z.string().min(1, "API key is required"),
  ENVIRONMENT: z.string().default("dev"),
  STAGE_NAME: z.string().default("prod"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  IMAGE_WIDTH: z.coerce
    .number()
    .int()
    .positive()
    .max(2048)
    .default(1024),
  IMAGE_HEIGHT: z.coerce
    .number()
    .int()
    .positive()
    .max(2048)
    .default(1024),
  AWS_S3_ENDPOINT: z.string().url().optional()
});

type AppConfig = z.infer<typeof envSchema>;

export const config: AppConfig = envSchema.parse(process.env);

export const isDebug = config.LOG_LEVEL === "debug";
