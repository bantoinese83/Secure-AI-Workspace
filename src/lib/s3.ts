/**
 * S3 operations for PDF storage.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3_BUCKET, AWS_REGION, isAwsConfigured } from "./aws-config";

const client = new S3Client({ region: AWS_REGION });

export function getPdfKey(userId: string, chatId: string, pdfId: string): string {
  return `${userId}/${chatId}/${pdfId}.pdf`;
}

export async function getPresignedUploadUrl(key: string, expiresIn = 300): Promise<string> {
  if (!isAwsConfigured()) return "";

  const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  if (!isAwsConfigured()) return null;

  try {
    const res = await client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    const body = res.Body;
    if (!body) return null;
    return new Uint8Array(await body.transformToByteArray());
  } catch {
    return null;
  }
}

export async function putObject(key: string, body: Buffer | Uint8Array): Promise<void> {
  if (!isAwsConfigured()) return;

  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/pdf",
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  if (!isAwsConfigured()) return;

  await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}
