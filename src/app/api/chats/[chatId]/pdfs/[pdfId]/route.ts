import { NextRequest, NextResponse } from "next/server";
import { getChat, updatePdfState, removePdf } from "@/lib/db";
import { getUserId, isValidId } from "@/lib/api-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string; pdfId: string }> }
) {
  const { chatId, pdfId } = await params;
  if (!isValidId(chatId) || !isValidId(pdfId)) {
    return NextResponse.json({ error: "Invalid chat or document" }, { status: 400 });
  }
  const userId = getUserId(req);
  const chat = await getChat(userId, chatId);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  let body: { state?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const state = body.state;
  if (state !== "active" && state !== "inactive") {
    return NextResponse.json({ error: "State must be active or inactive" }, { status: 400 });
  }
  const pdf = await updatePdfState(chatId, pdfId, state);
  if (!pdf) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json(pdf);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string; pdfId: string }> }
) {
  const { chatId, pdfId } = await params;
  if (!isValidId(chatId) || !isValidId(pdfId)) {
    return NextResponse.json({ error: "Invalid chat or document" }, { status: 400 });
  }
  const userId = getUserId(req);
  const chat = await getChat(userId, chatId);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  await removePdf(chatId, pdfId);
  return NextResponse.json({ ok: true });
}
