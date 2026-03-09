import { NextRequest, NextResponse } from "next/server";
import { getChat, updateChat, deleteChat } from "@/lib/db";
import { getUserId, isValidId } from "@/lib/api-utils";
import { LIMITS } from "@/lib/constants";

export async function GET(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  if (!isValidId(chatId)) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }
  const userId = getUserId(req);
  const chat = await getChat(userId, chatId);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  return NextResponse.json(chat);
}

function sanitizePatchString(value: unknown, maxLen: number): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLen);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  if (!isValidId(chatId)) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }
  const userId = getUserId(req);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const title =
    "title" in body ? sanitizePatchString(body.title, LIMITS.MAX_TITLE_LENGTH) : undefined;
  const instructionBox =
    "instructionBox" in body
      ? sanitizePatchString(body.instructionBox, LIMITS.MAX_INSTRUCTION_BOX_LENGTH)
      : undefined;
  if (title === undefined && instructionBox === undefined) {
    const chat = await getChat(userId, chatId);
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    return NextResponse.json(chat);
  }
  const chat = await updateChat(userId, chatId, { title, instructionBox });
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  return NextResponse.json(chat);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  if (!isValidId(chatId)) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }
  const userId = getUserId(req);
  const chat = await getChat(userId, chatId);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  await deleteChat(userId, chatId);
  return NextResponse.json({ ok: true });
}
