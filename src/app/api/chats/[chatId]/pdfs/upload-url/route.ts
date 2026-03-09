import { NextRequest, NextResponse } from "next/server";
import { getChat, addPdf } from "@/lib/db";
import { getUserId, isValidId, sanitizeFileName } from "@/lib/api-utils";
import { getPresignedUploadUrl, getPdfKey } from "@/lib/s3";
import { isAwsConfigured } from "@/lib/aws-config";

export async function POST(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  if (!isValidId(chatId)) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }
  const userId = getUserId(req);

  const chat = await getChat(userId, chatId);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  let body: { fileName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawFileName =
    body.fileName != null && typeof body.fileName === "string" ? body.fileName : "document.pdf";
  const fileName = sanitizeFileName(rawFileName);
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "File name must end with .pdf" }, { status: 400 });
  }

  const pdfId = crypto.randomUUID();
  const s3Key = isAwsConfigured() ? getPdfKey(userId, chatId, pdfId) : `${chatId}/${pdfId}.pdf`;

  try {
    const pdf = await addPdf(
      chatId,
      {
        fileName,
        s3Key,
        extractedText: "",
        state: "active",
      },
      pdfId
    );

    const url = isAwsConfigured() ? await getPresignedUploadUrl(s3Key) : `/api/upload-mock`;

    return NextResponse.json({
      url,
      pdfId: pdf.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not create upload. Please try again." },
      { status: 500 }
    );
  }
}
