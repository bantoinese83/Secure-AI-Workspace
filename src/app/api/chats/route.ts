import { NextRequest, NextResponse } from "next/server";
import { getChats, createChat } from "@/lib/db";
import { getUserId } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const chats = await getChats(userId);
    return NextResponse.json(chats);
  } catch {
    return NextResponse.json({ error: "Failed to load chats" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const chat = await createChat(userId);
    return NextResponse.json(chat);
  } catch {
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });
  }
}
