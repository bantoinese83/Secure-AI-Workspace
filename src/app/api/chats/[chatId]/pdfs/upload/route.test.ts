import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

const mockGetChat = vi.fn();
const mockAddPdf = vi.fn();

vi.mock("@/lib/db", () => ({
  getChat: (...args: unknown[]) => mockGetChat(...args),
  addPdf: (...args: unknown[]) => mockAddPdf(...args),
}));

vi.mock("@/lib/api-utils", () => ({
  getUserId: vi.fn(() => "test-user"),
  isValidId: vi.fn((id: string) => id != null && String(id).trim().length > 0),
  sanitizeFileName: vi.fn((name: string) => name.trim() || "document.pdf"),
}));

vi.mock("@/lib/aws-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aws-config")>();
  return {
    ...actual,
    isAwsConfigured: vi.fn(() => false),
  };
});

vi.mock("@/lib/pdf-extract", () => ({
  extractTextFromPdf: vi.fn(() => Promise.resolve("extracted text")),
}));

function createRequestWithFile(fileName: string, content: string = "pdf content"): NextRequest {
  const file = new File([content], fileName, { type: "application/pdf" });
  const form = new FormData();
  form.append("file", file);
  return new Request("http://localhost", {
    method: "POST",
    body: form,
  }) as unknown as NextRequest;
}

const params = (chatId: string) => Promise.resolve({ chatId });

describe("POST /api/chats/[chatId]/pdfs/upload", () => {
  beforeEach(() => {
    mockGetChat.mockReset();
    mockAddPdf.mockReset();
    mockGetChat.mockResolvedValue({
      id: "c1",
      title: "Chat",
      instructionBox: "",
      createdAt: "",
      updatedAt: "",
    });
    mockAddPdf.mockResolvedValue({
      id: "pdf-1",
      fileName: "test.pdf",
      s3Key: "",
      extractedText: "",
      state: "active",
      createdAt: "",
    });
  });

  it("returns 400 for invalid chatId", async () => {
    const res = await POST(createRequestWithFile("test.pdf"), { params: params("") });
    expect(res.status).toBe(400);
  });

  it("returns 404 when chat not found", async () => {
    mockGetChat.mockResolvedValue(null);
    const res = await POST(createRequestWithFile("test.pdf"), { params: params("c1") });
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file in form", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: new FormData(),
    }) as unknown as NextRequest;
    const res = await POST(req, { params: params("c1") });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/file/i);
  });

  it("returns 400 when file is empty", async () => {
    const res = await POST(createRequestWithFile("test.pdf", ""), { params: params("c1") });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/empty/i);
  });

  it("returns 400 when file is not PDF", async () => {
    const res = await POST(createRequestWithFile("doc.txt"), { params: params("c1") });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/PDF/i);
  });

  it("returns 200 and pdf id when upload succeeds", async () => {
    const res = await POST(createRequestWithFile("test.pdf"), { params: params("c1") });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ id: "pdf-1", fileName: "test.pdf" });
  });
});
