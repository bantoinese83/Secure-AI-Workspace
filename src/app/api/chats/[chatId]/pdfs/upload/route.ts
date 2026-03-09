import { NextRequest, NextResponse } from "next/server";
import { getChat, addPdf } from "@/lib/db";
import { getUserId, isValidId, sanitizeFileName } from "@/lib/api-utils";
import { putObject, getPdfKey } from "@/lib/s3";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { isAwsConfigured } from "@/lib/aws-config";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided. Use the 'file' field." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 10MB." },
      { status: 400 }
    );
  }

  const rawFileName = file.name?.trim();
  if (!rawFileName) {
    return NextResponse.json({ error: "File name is missing" }, { status: 400 });
  }
  if (!rawFileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  }
  const fileName = sanitizeFileName(rawFileName);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read file" }, { status: 400 });
  }

  const extractedText = await extractTextFromPdf(buffer);

  const pdfId = crypto.randomUUID();
  const s3Key = isAwsConfigured() ? getPdfKey(userId, chatId, pdfId) : `${chatId}/${pdfId}.pdf`;

  if (isAwsConfigured()) {
    try {
      await putObject(s3Key, buffer);
    } catch {
      return NextResponse.json(
        { error: "Storage is temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }
  }

  try {
    const pdf = await addPdf(
      chatId,
      {
        fileName,
        s3Key,
        extractedText,
        state: "active",
      },
      pdfId
    );

    return NextResponse.json({
      id: pdf.id,
      fileName: pdf.fileName,
    });
  } catch {
    return NextResponse.json(
      { error: "Document was uploaded but could not be saved. Please try again." },
      { status: 500 }
    );
  }
}
