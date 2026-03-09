/**
 * Database layer: DynamoDB when configured, otherwise mock.
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
import { DYNAMODB_TABLE, AWS_REGION, isAwsConfigured } from "./aws-config";
import { mockDb } from "./mock-db";
import type { Chat, ChatPdf, Message } from "@/types/chat";

const client = new DynamoDBClient({ region: AWS_REGION });

function safeUserId(userId: string): string {
  const t = userId?.trim();
  return t && t.length > 0 ? t : "dev-user-1";
}

function safeChatId(chatId: string): string | null {
  const t = chatId?.trim();
  return t && t.length > 0 ? t : null;
}

export async function getChats(
  userId: string
): Promise<{ id: string; title: string; updatedAt: string }[]> {
  if (!isAwsConfigured()) return mockDb.getChats();
  const uid = safeUserId(userId);
  if (!uid) return [];

  const res = await client.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": { S: `USER#${uid}` },
        ":sk": { S: "CHAT#" },
      },
    })
  );

  const items = (res.Items ?? []).map((i) => unmarshall(i) as Chat & { PK: string; SK: string });
  return items
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getChat(userId: string, chatId: string): Promise<Chat | null> {
  if (!isAwsConfigured()) return mockDb.getChat(chatId);
  const cid = safeChatId(chatId);
  if (!cid) return null;

  const res = await client.send(
    new GetItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `USER#${safeUserId(userId)}`, SK: `CHAT#${cid}` }),
    })
  );

  if (!res.Item) return null;
  const item = unmarshall(res.Item) as Chat & { PK: string; SK: string };
  return { ...item, id: cid };
}

export async function createChat(userId: string): Promise<{ id: string; title: string }> {
  if (!isAwsConfigured()) return mockDb.createChat();
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

  await client.send(
    new PutItemCommand({
      TableName: DYNAMODB_TABLE,
      Item: marshall(item),
    })
  );

  return { id: chatId, title: item.title };
}

export async function updateChat(
  userId: string,
  chatId: string,
  data: { title?: string; instructionBox?: string }
): Promise<Chat | null> {
  if (!isAwsConfigured()) return mockDb.updateChat(chatId, data);
  const cid = safeChatId(chatId);
  if (!cid) return null;

  const updates: string[] = [];
  const values: Record<string, unknown> = { ":updated": new Date().toISOString() };
  if (data.title !== undefined) {
    updates.push("title = :title");
    values[":title"] = data.title;
  }
  if (data.instructionBox !== undefined) {
    updates.push("instructionBox = :ib");
    values[":ib"] = data.instructionBox;
  }
  if (updates.length === 0) return getChat(userId, cid);

  updates.push("updatedAt = :updated");

  const res = await client.send(
    new UpdateItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `USER#${safeUserId(userId)}`, SK: `CHAT#${cid}` }),
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeValues: marshall(values),
      ReturnValues: "ALL_NEW",
    })
  );

  return res.Attributes ? (unmarshall(res.Attributes) as Chat) : null;
}

export async function deleteChat(userId: string, chatId: string): Promise<void> {
  if (!isAwsConfigured()) {
    mockDb.deleteChat(chatId);
    return;
  }
  const cid = safeChatId(chatId);
  if (!cid) return;

  const [messages, pdfs] = await Promise.all([getMessages(cid), getPdfs(cid)]);

  await Promise.all([
    client.send(
      new DeleteItemCommand({
        TableName: DYNAMODB_TABLE,
        Key: marshall({ PK: `USER#${safeUserId(userId)}`, SK: `CHAT#${cid}` }),
      })
    ),
    ...messages.map((m) =>
      client.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_TABLE,
          Key: marshall({ PK: `CHAT#${cid}`, SK: `MSG#${m.id}` }),
        })
      )
    ),
    ...pdfs.map((p) =>
      client.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_TABLE,
          Key: marshall({ PK: `CHAT#${cid}`, SK: `PDF#${p.id}` }),
        })
      )
    ),
  ]);
}

export async function getMessages(chatId: string): Promise<Message[]> {
  if (!isAwsConfigured()) return mockDb.getMessages(chatId);
  const cid = safeChatId(chatId);
  if (!cid) return [];

  const res = await client.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": { S: `CHAT#${cid}` },
        ":sk": { S: "MSG#" },
      },
    })
  );

  const items = (res.Items ?? []).map((i) => unmarshall(i) as Message & { PK: string; SK: string });
  return items.sort((a, b) => a.order - b.order);
}

export async function addMessage(
  chatId: string,
  msg: Omit<Message, "id" | "createdAt">
): Promise<Message> {
  if (!isAwsConfigured()) return mockDb.addMessage(chatId, msg);
  const cid = safeChatId(chatId);
  if (!cid) throw new Error("Chat ID is required");

  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();
  const item = {
    PK: `CHAT#${cid}`,
    SK: `MSG#${msgId}`,
    id: msgId,
    ...msg,
    createdAt: now,
  };

  await client.send(
    new PutItemCommand({
      TableName: DYNAMODB_TABLE,
      Item: marshall(item),
    })
  );

  return { ...item, id: msgId, createdAt: now };
}

export async function getPdfs(chatId: string): Promise<ChatPdf[]> {
  if (!isAwsConfigured()) return mockDb.getPdfs(chatId);
  const cid = safeChatId(chatId);
  if (!cid) return [];

  const res = await client.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": { S: `CHAT#${cid}` },
        ":sk": { S: "PDF#" },
      },
    })
  );

  return (res.Items ?? []).map((i) => unmarshall(i) as ChatPdf & { PK: string; SK: string });
}

export async function addPdf(
  chatId: string,
  pdf: Omit<ChatPdf, "id" | "createdAt">,
  existingId?: string
): Promise<ChatPdf> {
  const pdfId = (existingId?.trim() && existingId) ?? crypto.randomUUID();
  if (!isAwsConfigured()) return mockDb.addPdf(chatId, { ...pdf }, pdfId);
  const cid = safeChatId(chatId);
  if (!cid) throw new Error("Chat ID is required");

  const now = new Date().toISOString();
  const item = {
    PK: `CHAT#${cid}`,
    SK: `PDF#${pdfId}`,
    id: pdfId,
    ...pdf,
    createdAt: now,
  };

  await client.send(
    new PutItemCommand({
      TableName: DYNAMODB_TABLE,
      Item: marshall(item),
    })
  );

  return { ...item, id: pdfId, createdAt: now };
}

export async function updatePdfExtractedText(
  chatId: string,
  pdfId: string,
  extractedText: string
): Promise<void> {
  if (!isAwsConfigured()) return;
  const cid = safeChatId(chatId);
  if (!cid || !pdfId?.trim()) return;

  await client.send(
    new UpdateItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `CHAT#${cid}`, SK: `PDF#${pdfId.trim()}` }),
      UpdateExpression: "SET extractedText = :text",
      ExpressionAttributeValues: marshall({ ":text": extractedText }),
    })
  );
}

export async function updatePdfState(
  chatId: string,
  pdfId: string,
  state: "active" | "inactive"
): Promise<ChatPdf | null> {
  if (!isAwsConfigured()) return mockDb.updatePdfState(chatId, pdfId, state);
  const cid = safeChatId(chatId);
  if (!cid || !pdfId?.trim()) return null;

  const res = await client.send(
    new UpdateItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `CHAT#${cid}`, SK: `PDF#${pdfId.trim()}` }),
      UpdateExpression: "SET #state = :state",
      ExpressionAttributeNames: { "#state": "state" },
      ExpressionAttributeValues: marshall({ ":state": state }),
      ReturnValues: "ALL_NEW",
    })
  );

  return res.Attributes ? (unmarshall(res.Attributes) as ChatPdf) : null;
}

export async function removePdf(chatId: string, pdfId: string): Promise<void> {
  if (!isAwsConfigured()) {
    mockDb.removePdf(chatId, pdfId);
    return;
  }
  const cid = safeChatId(chatId);
  if (!cid || !pdfId?.trim()) return;

  await client.send(
    new DeleteItemCommand({
      TableName: DYNAMODB_TABLE,
      Key: marshall({ PK: `CHAT#${cid}`, SK: `PDF#${pdfId.trim()}` }),
    })
  );
}
