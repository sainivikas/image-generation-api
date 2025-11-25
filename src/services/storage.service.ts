import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config";

const client = new S3Client({
  region: config.AWS_REGION,
  ...(config.AWS_S3_ENDPOINT ? { endpoint: config.AWS_S3_ENDPOINT, forcePathStyle: true } : {})
});

export async function uploadImageToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: config.IMAGES_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `https://${config.IMAGES_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
}
