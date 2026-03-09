/**
 * Chat stream Lambda – Bedrock Claude streaming, optional Tavily web search.
 * POST body: { message, useWebSearch }. Path param: chatId. Header: x-user-id.
 * Returns SSE body: data: {"text":"..."} then data: [DONE] or data: {"error":"..."}.
 * Env: DYNAMODB_TABLE, S3_BUCKET, BEDROCK_MODEL_ID, TAVILY_API_KEY (optional), AWS_REGION.
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { tavily } from "@tavily/core";

const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE ?? "";
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20241022-v2:0";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "";

const LIMITS = { MAX_MESSAGE_LENGTH: 100_000, MIN_ID_LENGTH: 1, MAX_USER_ID_LENGTH: 128 };
const INVALID_ID_REGEX = /[\x00-\x1F\x7F]/;
const DEFAULT_USER_ID = "dev-user-1";
const WEB_SEARCH_PATTERNS = [
  /search\s+the\s+web/i,
  /use\s+web\s+search/i,
  /search\s+the\s+internet/i,
  /look\s+up\s+online/i,
];

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant working inside a private single-user workspace.
Follow the current chat instructions provided by the user.
Use only the PDFs marked Active for this chat.
Ignore PDFs marked Inactive.
If the user asks to edit pasted text, focus only on the pasted text unless the user explicitly asks you to reference an attached PDF.
Use web search only when web results are explicitly provided for this turn.
Be clear, accurate, and concise.`;

const dynamo = new DynamoDBClient({ region: AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: AWS_REGION });

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

function safeUserId(userId) {
  const t = (userId ?? "").trim();
  return t && t.length > 0 ? t : DEFAULT_USER_ID;
}

function safeChatId(chatId) {
  const t = (chatId ?? "").trim();
  return t && t.length > 0 ? t : null;
}

function detectWebSearchRequest(message) {
  return WEB_SEARCH_PATTERNS.some((p) => p.test(message));
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

async function addMessage(chatId, msg) {
  const cid = safeChatId(chatId);
  if (!cid) return;
  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();
  const item = { PK: `CHAT#${cid}`, SK: `MSG#${msgId}`, id: msgId, ...msg, createdAt: now };
  await dynamo.send(
    new PutItemCommand({ TableName: DYNAMODB_TABLE, Item: marshall(item) })
  );
}

async function tavilySearch(query, maxResults = 5) {
  if (!TAVILY_API_KEY) return [];
  try {
    const client = tavily({ apiKey: TAVILY_API_KEY });
    const response = await client.search(query, {
      maxResults,
      searchDepth: "basic",
      includeAnswer: false,
    });
    const results = response.results ?? [];
    return results.map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: r.content ?? "",
    }));
  } catch {
    return [];
  }
}

function formatTavilyForContext(results) {
  if (!results.length) return "";
  return (
    "\n\nWeb search results:\n" +
    results.map((r) => `--- ${r.title} (${r.url}) ---\n${r.content}`).join("\n\n")
  );
}

async function* streamClaude(messages, systemPrompt) {
  const anthropicMessages = messages.map((m) => ({
    role: m.role,
    content: [{ type: "text", text: m.content }],
  }));
  const response = await bedrock.send(
    new InvokeModelWithResponseStreamCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    })
  );
  const stream = response.body;
  if (!stream) return;
  const decoder = new TextDecoder();
  for await (const event of stream) {
    if (!("chunk" in event) || !event.chunk?.bytes) continue;
    try {
      const chunk = JSON.parse(decoder.decode(event.chunk.bytes));
      if (chunk?.type === "content_block_delta" && typeof chunk.delta?.text === "string") {
        yield chunk.delta.text;
      }
    } catch {
      // skip
    }
  }
}

function sseLine(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  if (method !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const pathParams = event.pathParameters ?? {};
  const chatId = pathParams.chatId ?? null;
  const headers = event.headers ?? {};
  const userId = getUserId(headers);

  if (!isValidId(chatId)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid chat" }),
    };
  }

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body ?? "{}") : event.body ?? {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid request body" }),
    };
  }

  const rawMessage = body.message;
  if (rawMessage == null || typeof rawMessage !== "string") {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Message is required" }),
    };
  }
  const message = rawMessage.trim();
  if (!message) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Message cannot be empty" }),
    };
  }
  if (message.length > LIMITS.MAX_MESSAGE_LENGTH) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: `Message is too long (max ${LIMITS.MAX_MESSAGE_LENGTH} characters)`,
      }),
    };
  }

  const useWebSearch = Boolean(body.useWebSearch);

  const chat = await getChat(userId, chatId);
  if (!chat) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Chat not found" }),
    };
  }

  const pdfs = (await getPdfs(chatId)).filter((p) => p.state === "active");
  const pdfContext = pdfs
    .map((p) => `--- PDF: ${p.fileName} ---\n${p.extractedText || "(No text extracted)"}`)
    .join("\n\n");
  const messages = await getMessages(chatId);
  const recentMessages = messages.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  await addMessage(chatId, { role: "user", content: message, order: messages.length });

  const instructionContext = chat.instructionBox
    ? `\n\nCurrent chat instructions from the user:\n${chat.instructionBox}`
    : "";
  const pdfContextBlock = pdfContext ? `\n\nActive PDF content for this chat:\n${pdfContext}` : "";
  const conversationContext =
    recentMessages.length > 0
      ? `\n\nRecent conversation:\n${recentMessages
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}`
      : "";

  let webContext = "";
  const shouldUseWebSearch = useWebSearch || detectWebSearchRequest(message);
  if (shouldUseWebSearch) {
    try {
      const results = await tavilySearch(message, 5);
      webContext = formatTavilyForContext(results);
    } catch {
      webContext = "\n\n[Web search was unavailable for this request.]";
    }
  }

  const systemPrompt =
    BASE_SYSTEM_PROMPT + instructionContext + pdfContextBlock + conversationContext + webContext;

  const conversationMessages = [
    ...recentMessages,
    { role: "user", content: message },
  ];

  const chunks = [];
  let fullResponse = "";
  try {
    for await (const chunk of streamClaude(conversationMessages, systemPrompt)) {
      fullResponse += chunk;
      chunks.push(sseLine({ text: chunk }));
    }
  } catch (streamErr) {
    const errMsg =
      streamErr instanceof Error ? streamErr.message : "The response could not be completed.";
    chunks.push(sseLine({ error: errMsg }));
    fullResponse = fullResponse || errMsg;
  }

  try {
    await addMessage(chatId, {
      role: "assistant",
      content: fullResponse,
      order: messages.length + 1,
    });
  } catch {
    // best effort
  }

  chunks.push("data: [DONE]\n\n");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
    body: chunks.join(""),
  };
};
