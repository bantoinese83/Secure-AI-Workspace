/**
 * Chat API Lambda – CRUD for chats, messages, PDFs; presigned upload URL.
 * Wire to API Gateway HTTP API (v2); path parameters: chatId, pdfId.
 * Env: DYNAMODB_TABLE, S3_BUCKET, AWS_REGION (optional).
 */

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE ?? "";
const S3_BUCKET = process.env.S3_BUCKET ?? "";

const LIMITS = {
  MAX_TITLE_LENGTH: 500,
  MAX_INSTRUCTION_BOX_LENGTH: 10_000,
  MAX_FILE_NAME_LENGTH: 255,
  MIN_ID_LENGTH: 1,
  MAX_USER_ID_LENGTH: 128,
};

const INVALID_ID_REGEX = /[\x00-\x1F\x7F]/;
const DEFAULT_USER_ID = "dev-user-1";

const dynamo = new DynamoDBClient({ region: AWS_REGION });
const s3 = new S3Client({ region: AWS_REGION });

function getUserId(headers) {
  const raw = (headers["x-user-id"] ?? headers["X-User-Id"] ?? "").trim() || DEFAULT_USER_ID;
  if (raw.length > LIMITS.MAX_USER_ID_LENGTH) return raw.slice(0, LIMITS.MAX_USER_ID_LENGTH);
  if (INVALID_ID_REGEX.test(raw)) return DEFAULT_USER_ID;
  return raw || DEFAULT_USER_ID;
}

function isValidId(id, minLength = LIMITS.MIN_ID_LENGTH) {
  if (id == null || typeof id !== "string") return false;
  const t = id.trim();
  return t.length >= minLength && !INVALID_ID_REGEX.test(t);
}

function sanitizeFileName(name) {
  const t = (name ?? "").trim();
  if (!t) return "document.pdf";
  return t.replace(/[/\\?%*:|"<>]/g, "_").slice(0, LIMITS.MAX_FILE_NAME_LENGTH) || "document.pdf";
}

function safeUserId(userId) {
  const t = (userId ?? "").trim();
  return t && t.length > 0 ? t : DEFAULT_USER_ID;
}

function safeChatId(chatId) {
  const t = (chatId ?? "").trim();
  return t && t.length > 0 ? t : null;
}

function getPdfKey(userId, chatId, pdfId) {
  return `${userId}/${chatId}/${pdfId}.pdf`;
}

function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ---------- DynamoDB helpers ----------

async function getChats(userId) {
  const uid = safeUserId(userId);
  if (!uid) return [];
  const res = await dynamo.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": { S: `USER#${uid}` },
        ":sk": { S: "CHAT#" },
      },
    })
  );
  const items = (res.Items ?? []).map((i) => unmarshall(i));
  return items
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function getChat(userId, chatId) {
  const cid = safeChatId(chatId);
  if (!cid) return null;
  const res = await dynamo.send(
    new GetItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `USER#${safeUserId(userId)}`, SK: `CHAT#${cid}` }),
    })
  );
  if (!res.Item) return null;
  const item = unmarshall(res.Item);
  return { ...item, id: cid };
}

async function createChat(userId) {
  const uid = safeUserId(userId);
  const chatId = crypto.randomUUID();
  const now = new Date().toISOString();
  const item = {
    PK: `USER#${uid}`,
    SK: `CHAT#${chatId}`,
    id: chatId,
    title: "New Chat",
    instructionBox: "",
    createdAt: now,
    updatedAt: now,
  };
  await dynamo.send(
    new PutItemCommand({ TableName: DYNAMODB_TABLE, Item: marshall(item) })
  );
  return { id: chatId, title: item.title };
}

function sanitizePatchString(value, maxLen) {
  if (value == null || typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLen);
}

async function updateChat(userId, chatId, data) {
  const cid = safeChatId(chatId);
  if (!cid) return null;
  const updates = [];
  const values = { ":updated": new Date().toISOString() };
  if (data.title !== undefined) {
    updates.push("title = :title");
    values[":title"] = data.title;
  }
  if (data.instructionBox !== undefined) {
    updates.push("instructionBox = :ib");
    values[":ib"] = data.instructionBox;
  }
  if (updates.length === 0) return getChat(userId, chatId);
  updates.push("updatedAt = :updated");
  const res = await dynamo.send(
    new UpdateItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `USER#${safeUserId(userId)}`, SK: `CHAT#${cid}` }),
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeValues: marshall(values),
      ReturnValues: "ALL_NEW",
    })
  );
  return res.Attributes ? unmarshall(res.Attributes) : null;
}

async function getMessages(chatId) {
  const cid = safeChatId(chatId);
  if (!cid) return [];
  const res = await dynamo.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": { S: `CHAT#${cid}` }, ":sk": { S: "MSG#" } },
    })
  );
  const items = (res.Items ?? []).map((i) => unmarshall(i));
  return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function getPdfs(chatId) {
  const cid = safeChatId(chatId);
  if (!cid) return [];
  const res = await dynamo.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": { S: `CHAT#${cid}` }, ":sk": { S: "PDF#" } },
    })
  );
  return (res.Items ?? []).map((i) => unmarshall(i));
}

async function getPdf(chatId, pdfId) {
  const cid = safeChatId(chatId);
  if (!cid || !(pdfId ?? "").trim()) return null;
  const res = await dynamo.send(
    new GetItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `CHAT#${cid}`, SK: `PDF#${pdfId.trim()}` }),
    })
  );
  return res.Item ? unmarshall(res.Item) : null;
}

async function addPdf(chatId, pdf, pdfId) {
  const cid = safeChatId(chatId);
  if (!cid) throw new Error("Chat ID is required");
  const id = (pdfId ?? "").trim() ? pdfId.trim() : crypto.randomUUID();
  const now = new Date().toISOString();
  const item = { PK: `CHAT#${cid}`, SK: `PDF#${id}`, id, ...pdf, createdAt: now };
  await dynamo.send(
    new PutItemCommand({ TableName: DYNAMODB_TABLE, Item: marshall(item) })
  );
  return { ...item, id, createdAt: now };
}

async function updatePdfState(chatId, pdfId, state) {
  const cid = safeChatId(chatId);
  if (!cid || !(pdfId ?? "").trim()) return null;
  const res = await dynamo.send(
    new UpdateItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `CHAT#${cid}`, SK: `PDF#${pdfId.trim()}` }),
      UpdateExpression: "SET #state = :state",
      ExpressionAttributeNames: { "#state": "state" },
      ExpressionAttributeValues: marshall({ ":state": state }),
      ReturnValues: "ALL_NEW",
    })
  );
  return res.Attributes ? unmarshall(res.Attributes) : null;
}

async function removePdf(chatId, pdfId) {
  const cid = safeChatId(chatId);
  if (!cid || !(pdfId ?? "").trim()) return;
  await dynamo.send(
    new DeleteItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `CHAT#${cid}`, SK: `PDF#${pdfId.trim()}` }),
    })
  );
}

async function deleteChat(userId, chatId) {
  const cid = safeChatId(chatId);
  if (!cid) return;
  const [messages, pdfs] = await Promise.all([getMessages(cid), getPdfs(cid)]);
  await Promise.all([
    dynamo.send(
      new DeleteItemCommand({
        TableName: DYNAMODB_TABLE,
        Key: marshall({ PK: `USER#${safeUserId(userId)}`, SK: `CHAT#${cid}` }),
      })
    ),
    ...messages.map((m) =>
      dynamo.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_TABLE,
          Key: marshall({ PK: `CHAT#${cid}`, SK: `MSG#${m.id}` }),
        })
      )
    ),
    ...pdfs.map((p) =>
      dynamo.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_TABLE,
          Key: marshall({ PK: `CHAT#${cid}`, SK: `PDF#${p.id}` }),
        })
      )
    ),
  ]);
}

// ---------- Route handlers ----------

async function handleGetChats(userId) {
  const chats = await getChats(userId);
  return jsonResponse(chats);
}

async function handlePostChats(userId) {
  const chat = await createChat(userId);
  return jsonResponse(chat);
}

async function handleGetChat(userId, chatId) {
  const chat = await getChat(userId, chatId);
  if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
  return jsonResponse(chat);
}

async function handlePatchChat(userId, chatId, body) {
  const title = body.title != null ? sanitizePatchString(body.title, LIMITS.MAX_TITLE_LENGTH) : undefined;
  const instructionBox = body.instructionBox != null ? sanitizePatchString(body.instructionBox, LIMITS.MAX_INSTRUCTION_BOX_LENGTH) : undefined;
  if (title === undefined && instructionBox === undefined) {
    const chat = await getChat(userId, chatId);
    if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
    return jsonResponse(chat);
  }
  const chat = await updateChat(userId, chatId, { title, instructionBox });
  if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
  return jsonResponse(chat);
}

async function handleDeleteChat(userId, chatId) {
  const chat = await getChat(userId, chatId);
  if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
  await deleteChat(userId, chatId);
  return jsonResponse({ ok: true });
}

async function handleGetMessages(userId, chatId) {
  const chat = await getChat(userId, chatId);
  if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
  const messages = await getMessages(chatId);
  return jsonResponse(messages);
}

async function handleGetPdfs(userId, chatId) {
  const chat = await getChat(userId, chatId);
  if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
  const pdfs = await getPdfs(chatId);
  return jsonResponse(pdfs);
}

async function handlePostPdfsUploadUrl(userId, chatId, body) {
  if (!DYNAMODB_TABLE || !S3_BUCKET) {
    return jsonResponse({ error: "Upload is not configured" }, 503);
  }
  const rawFileName = (body?.fileName != null && typeof body.fileName === "string") ? body.fileName : "document.pdf";
  const fileName = sanitizeFileName(rawFileName);
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return jsonResponse({ error: "File name must end with .pdf" }, 400);
  }
  const pdfId = crypto.randomUUID();
  const s3Key = getPdfKey(userId, chatId, pdfId);
  const pdf = await addPdf(
    chatId,
    { fileName, s3Key, extractedText: "", state: "active" },
    pdfId
  );
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
    { expiresIn: 300 }
  );
  return jsonResponse({ url, pdfId: pdf.id });
}

async function handlePatchPdf(userId, chatId, pdfId, body) {
  const state = body?.state;
  if (state !== "active" && state !== "inactive") {
    return jsonResponse({ error: "State must be active or inactive" }, 400);
  }
  const chat = await getChat(userId, chatId);
  if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
  const pdf = await updatePdfState(chatId, pdfId, state);
  if (!pdf) return jsonResponse({ error: "Document not found" }, 404);
  return jsonResponse(pdf);
}

async function handleDeletePdf(userId, chatId, pdfId) {
  const chat = await getChat(userId, chatId);
  if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
  const pdf = await getPdf(chatId, pdfId);
  if (pdf?.s3Key && S3_BUCKET) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: pdf.s3Key }));
    } catch {
      // continue to remove from DB
    }
  }
  await removePdf(chatId, pdfId);
  return jsonResponse({ ok: true });
}

// ---------- Router ----------

function parseBody(event) {
  const b = event.body;
  if (!b) return null;
  if (typeof b === "object") return b;
  try {
    return JSON.parse(b);
  } catch {
    return null;
  }
}

/**
 * API Gateway HTTP API (v2) event.
 * Path examples: /chats, /chats/{chatId}, /chats/{chatId}/messages, /chats/{chatId}/pdfs, /chats/{chatId}/pdfs/upload-url, /chats/{chatId}/pdfs/{pdfId}
 */
export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path = event.rawPath ?? event.path ?? "";
  const pathParams = event.pathParameters ?? {};
  const chatId = pathParams.chatId ?? null;
  const pdfId = pathParams.pdfId ?? null;
  const headers = event.headers ?? {};
  const userId = getUserId(headers);
  const body = parseBody(event);

  try {
    // GET /chats
    if (method === "GET" && path === "/chats") {
      return await handleGetChats(userId);
    }
    // POST /chats
    if (method === "POST" && path === "/chats") {
      return await handlePostChats(userId);
    }
    // GET /chats/{chatId}
    if (method === "GET" && chatId && !path.includes("/messages") && !path.includes("/pdfs")) {
      if (!isValidId(chatId)) return jsonResponse({ error: "Invalid chat" }, 400);
      return await handleGetChat(userId, chatId);
    }
    // PATCH /chats/{chatId}
    if (method === "PATCH" && chatId && !path.includes("/pdfs")) {
      if (!isValidId(chatId)) return jsonResponse({ error: "Invalid chat" }, 400);
      return await handlePatchChat(userId, chatId, body ?? {});
    }
    // DELETE /chats/{chatId}
    if (method === "DELETE" && chatId && !path.includes("/pdfs")) {
      if (!isValidId(chatId)) return jsonResponse({ error: "Invalid chat" }, 400);
      return await handleDeleteChat(userId, chatId);
    }
    // GET /chats/{chatId}/messages
    if (method === "GET" && path.includes("/messages")) {
      if (!isValidId(chatId)) return jsonResponse({ error: "Invalid chat" }, 400);
      return await handleGetMessages(userId, chatId);
    }
    // GET /chats/{chatId}/pdfs
    if (method === "GET" && path.includes("/pdfs") && !pdfId) {
      if (!isValidId(chatId)) return jsonResponse({ error: "Invalid chat" }, 400);
      return await handleGetPdfs(userId, chatId);
    }
    // POST /chats/{chatId}/pdfs/upload-url
    if (method === "POST" && path.includes("/pdfs/upload-url")) {
      if (!isValidId(chatId)) return jsonResponse({ error: "Invalid chat" }, 400);
      const chat = await getChat(userId, chatId);
      if (!chat) return jsonResponse({ error: "Chat not found" }, 404);
      return await handlePostPdfsUploadUrl(userId, chatId, body ?? {});
    }
    // PATCH /chats/{chatId}/pdfs/{pdfId}
    if (method === "PATCH" && pdfId) {
      if (!isValidId(chatId) || !isValidId(pdfId)) return jsonResponse({ error: "Invalid chat or document" }, 400);
      return await handlePatchPdf(userId, chatId, pdfId, body ?? {});
    }
    // DELETE /chats/{chatId}/pdfs/{pdfId}
    if (method === "DELETE" && pdfId) {
      if (!isValidId(chatId) || !isValidId(pdfId)) return jsonResponse({ error: "Invalid chat or document" }, 400);
      return await handleDeletePdf(userId, chatId, pdfId);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (err) {
    const msg = err?.message ?? "Something went wrong. Please try again.";
    return jsonResponse({ error: msg }, 500);
  }
};
