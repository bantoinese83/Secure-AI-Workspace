/**
 * PDF process Lambda – S3 trigger: when a PDF is uploaded, extract text and update DynamoDB.
 * Expects S3 key format: {userId}/{chatId}/{pdfId}.pdf
 * Env: DYNAMODB_TABLE, AWS_REGION.
 */

import { createRequire } from "module";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE ?? "";

const s3 = new S3Client({ region: AWS_REGION });
const dynamo = new DynamoDBClient({ region: AWS_REGION });

/**
 * Parse S3 key "userId/chatId/pdfId.pdf" -> { userId, chatId, pdfId } or null.
 */
function parsePdfKey(key) {
  if (typeof key !== "string" || !key.endsWith(".pdf")) return null;
  const parts = key.slice(0, -4).split("/");
  if (parts.length !== 3) return null;
  const [userId, chatId, pdfId] = parts;
  if (!userId || !chatId || !pdfId) return null;
  return { userId, chatId, pdfId };
}

async function getObjectBytes(bucket, key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body;
  if (!body) return null;
  return new Uint8Array(await body.transformToByteArray());
}

async function extractTextFromPdfBuffer(buffer) {
  try {
    const data = await pdfParse(Buffer.from(buffer));
    return (data?.text ?? "").trim();
  } catch {
    return "";
  }
}

async function updatePdfExtractedText(chatId, pdfId, extractedText) {
  if (!DYNAMODB_TABLE || !chatId || !pdfId) return;
  await dynamo.send(
    new UpdateItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `CHAT#${chatId}`, SK: `PDF#${pdfId}` }),
      UpdateExpression: "SET extractedText = :text",
      ExpressionAttributeValues: marshall({ ":text": extractedText }),
    })
  );
}

/**
 * S3 event handler. Event may contain multiple records (e.g. multiple uploads).
 */
export const handler = async (event) => {
  if (!DYNAMODB_TABLE) {
    console.warn("DYNAMODB_TABLE not set; skipping PDF processing");
    return { processed: 0 };
  }

  const records = event?.Records ?? [];
  let processed = 0;

  for (const record of records) {
    const bucket = record.s3?.bucket?.name;
    const key = decodeURIComponent(record.s3?.object?.key ?? "").replace(/\+/g, " ");
    if (!bucket || !key) continue;

    const parsed = parsePdfKey(key);
    if (!parsed) {
      console.warn("Skipping key (expected userId/chatId/pdfId.pdf):", key);
      continue;
    }

    try {
      const bytes = await getObjectBytes(bucket, key);
      if (!bytes || bytes.length === 0) continue;

      const extractedText = await extractTextFromPdfBuffer(bytes);
      await updatePdfExtractedText(parsed.chatId, parsed.pdfId, extractedText);
      processed++;
    } catch (err) {
      console.error("Error processing PDF", key, err);
      throw err;
    }
  }

  return { processed };
};
