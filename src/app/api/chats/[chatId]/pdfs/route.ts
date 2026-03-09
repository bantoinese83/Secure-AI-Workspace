import { NextRequest, NextResponse } from "next/server";
import { getChat, getPdfs } from "@/lib/db";
import { getUserId, isValidId } from "@/lib/api-utils";

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
  const pdfs = await getPdfs(chatId);
  return NextResponse.json(pdfs);
}
