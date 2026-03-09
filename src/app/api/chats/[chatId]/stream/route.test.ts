import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";
import { LIMITS } from "@/lib/constants";

const mockGetChat = vi.fn();
const mockGetMessages = vi.fn();
const mockGetPdfs = vi.fn();
const mockAddMessage = vi.fn();

vi.mock("@/lib/db", () => ({
  getChat: (...args: unknown[]) => mockGetChat(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  getPdfs: (...args: unknown[]) => mockGetPdfs(...args),
  addMessage: (...args: unknown[]) => mockAddMessage(...args),
}));

vi.mock("@/lib/api-utils", () => ({
  getUserId: vi.fn(() => "test-user"),
  isValidId: vi.fn((id: string) => id != null && String(id).trim().length > 0),
}));

vi.mock("@/lib/aws-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aws-config")>();
  return {
    ...actual,
    isAwsConfigured: vi.fn(() => false),
  };
});

function createRequest(body: object): NextRequest {
  return new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as unknown as NextRequest;
}

const params = (chatId: string) => Promise.resolve({ chatId });

describe("POST /api/chats/[chatId]/stream", () => {
  beforeEach(() => {
    mockGetChat.mockReset();
    mockGetMessages.mockReset();
    mockGetPdfs.mockReset();
    mockAddMessage.mockReset();
    mockGetMessages.mockResolvedValue([]);
    mockGetPdfs.mockResolvedValue([]);
    mockAddMessage.mockResolvedValue({});
  });

  it("returns 400 for invalid chatId", async () => {
    const res = await POST(createRequest({ message: "hi" }), { params: params("") });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid request body", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    }) as unknown as NextRequest;
    const res = await POST(req, { params: params("c1") });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not object", async () => {
    const res = await POST(createRequest([]), { params: params("c1") });
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(createRequest({}), { params: params("c1") });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/message/i);
  });

  it("returns 400 when message is empty after trim", async () => {
    const res = await POST(createRequest({ message: "   " }), { params: params("c1") });
    expect(res.status).toBe(400);
  });

  it("returns 400 when message exceeds max length", async () => {
    const res = await POST(createRequest({ message: "x".repeat(LIMITS.MAX_MESSAGE_LENGTH + 1) }), {
      params: params("c1"),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when chat not found", async () => {
    mockGetChat.mockResolvedValue(null);
    const res = await POST(createRequest({ message: "hello" }), { params: params("c1") });
    expect(res.status).toBe(404);
  });

  it("returns 200 and stream when chat exists", async () => {
    mockGetChat.mockResolvedValue({
      id: "c1",
      title: "Chat",
      instructionBox: "",
      createdAt: "",
      updatedAt: "",
    });
    const res = await POST(createRequest({ message: "hello" }), { params: params("c1") });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("data:");
    expect(text).toContain("[DONE]");
  });
});
