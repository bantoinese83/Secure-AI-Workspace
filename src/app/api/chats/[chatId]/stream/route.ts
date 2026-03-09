import { NextRequest, NextResponse } from "next/server";
import { getChat, getMessages, getPdfs, addMessage } from "@/lib/db";
import { getUserId, isValidId } from "@/lib/api-utils";
import { streamClaude } from "@/lib/bedrock";
import { search, formatTavilyResultsForContext } from "@/lib/tavily";
import { BASE_SYSTEM_PROMPT, WEB_SEARCH_PATTERNS, LIMITS } from "@/lib/constants";
import { isAwsConfigured } from "@/lib/aws-config";

function detectWebSearchRequest(message: string): boolean {
  return WEB_SEARCH_PATTERNS.some((p) => p.test(message));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  if (!isValidId(chatId)) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }
  const userId = getUserId(req);

  let body: { message?: unknown; useWebSearch?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawMessage = body.message;
  if (rawMessage == null || typeof rawMessage !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  const message = rawMessage.trim();
  if (message.length === 0) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }
  if (message.length > LIMITS.MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long (max ${LIMITS.MAX_MESSAGE_LENGTH} characters)` },
      { status: 400 }
    );
  }

  const useWebSearch = Boolean(body.useWebSearch);

  const chat = await getChat(userId, chatId);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const pdfs = (await getPdfs(chatId)).filter((p) => p.state === "active");
  const pdfContext = pdfs
    .map((p) => `--- PDF: ${p.fileName} ---\n${p.extractedText || "(No text extracted)"}`)
    .join("\n\n");

  const messages = await getMessages(chatId);
  const recentMessages = messages.slice(-10).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  await addMessage(chatId, {
    role: "user",
    content: message,
    order: messages.length,
  });

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
      const results = await search(message, 5);
      webContext = formatTavilyResultsForContext(results);
    } catch {
      webContext = "\n\n[Web search was unavailable for this request.]";
    }
  }

  const systemPrompt =
    BASE_SYSTEM_PROMPT + instructionContext + pdfContextBlock + conversationContext + webContext;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendError = (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      };
      try {
        if (isAwsConfigured()) {
          const conversationMessages = [
            ...recentMessages,
            { role: "user" as const, content: message },
          ];
          let fullResponse = "";
          try {
            for await (const chunk of streamClaude(conversationMessages, systemPrompt)) {
              fullResponse += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
          } catch (streamErr) {
            sendError(streamErr);
            fullResponse =
              fullResponse ||
              (streamErr instanceof Error
                ? streamErr.message
                : "The response could not be completed.");
          }
          try {
            await addMessage(chatId, {
              role: "assistant",
              content: fullResponse,
              order: messages.length + 1,
            });
          } catch {
            // Best effort: message was streamed; DB write failed
          }
        } else {
          const mockResponse =
            `This is a mock response. In production, Claude via Bedrock would stream here.` +
            `\n\nYour message: "${message.slice(0, 50)}..."` +
            (instructionContext ? `\n\nInstruction box is active.` : "") +
            (pdfContextBlock ? `\n\n${pdfs.length} active PDF(s) would be used as context.` : "") +
            (conversationContext ? `\n\nConversation history would be included.` : "") +
            (webContext ? `\n\nWeb search results would be included.` : "");

          for (const word of mockResponse.split(" ")) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word + " " })}\n\n`));
            await new Promise((r) => setTimeout(r, 30));
          }

          try {
            await addMessage(chatId, {
              role: "assistant",
              content: mockResponse,
              order: messages.length + 1,
            });
          } catch {
            // Mock DB failed; stream was already sent
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        sendError(err);
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
