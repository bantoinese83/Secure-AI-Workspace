import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "./route";

const mockGetChat = vi.fn();
const mockUpdateChat = vi.fn();
const mockDeleteChat = vi.fn();

vi.mock("@/lib/db", () => ({
  getChat: (...args: unknown[]) => mockGetChat(...args),
  updateChat: (...args: unknown[]) => mockUpdateChat(...args),
  deleteChat: (...args: unknown[]) => mockDeleteChat(...args),
}));

vi.mock("@/lib/api-utils", () => ({
  getUserId: vi.fn(() => "test-user"),
  isValidId: vi.fn((id: string) => id != null && String(id).trim().length > 0),
}));

function createRequest(url = "http://localhost/api/chats/chat-1", init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

const params = (chatId: string) => Promise.resolve({ chatId });

describe("GET /api/chats/[chatId]", () => {
  beforeEach(() => {
    mockGetChat.mockReset();
  });

  it("returns 400 for invalid chatId", async () => {
    const res = await GET(createRequest(), { params: params("") });
    expect(res.status).toBe(400);
  });

  it("returns 404 when chat not found", async () => {
    mockGetChat.mockResolvedValue(null);
    const res = await GET(createRequest(), { params: params("missing-id") });
    expect(res.status).toBe(404);
  });

  it("returns 200 and chat when found", async () => {
    const chat = {
      id: "c1",
      title: "My Chat",
      instructionBox: "",
      createdAt: "",
      updatedAt: "",
    };
    mockGetChat.mockResolvedValue(chat);
    const res = await GET(createRequest(), { params: params("c1") });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ id: "c1", title: "My Chat" });
  });
});

describe("PATCH /api/chats/[chatId]", () => {
  beforeEach(() => {
    mockGetChat.mockReset();
    mockUpdateChat.mockReset();
  });

  it("returns 400 for invalid body", async () => {
    const res = await PATCH(
      createRequest("http://localhost", {
        method: "PATCH",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      }),
      { params: params("c1") }
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not object", async () => {
    const res = await PATCH(
      createRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify("string"),
        headers: { "Content-Type": "application/json" },
      }),
      { params: params("c1") }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when chat not found on update", async () => {
    mockUpdateChat.mockResolvedValue(null);
    const res = await PATCH(
      createRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "New Title" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: params("c1") }
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 and updated chat", async () => {
    const updated = {
      id: "c1",
      title: "New Title",
      instructionBox: "",
      createdAt: "",
      updatedAt: "",
    };
    mockUpdateChat.mockResolvedValue(updated);
    const res = await PATCH(
      createRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "New Title" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: params("c1") }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("New Title");
  });
});

describe("DELETE /api/chats/[chatId]", () => {
  beforeEach(() => {
    mockGetChat.mockReset();
    mockDeleteChat.mockReset();
  });

  it("returns 404 when chat not found", async () => {
    mockGetChat.mockResolvedValue(null);
    const res = await DELETE(createRequest(), { params: params("c1") });
    expect(res.status).toBe(404);
  });

  it("returns 200 and deletes when chat exists", async () => {
    mockGetChat.mockResolvedValue({ id: "c1", title: "Chat" });
    const res = await DELETE(createRequest(), { params: params("c1") });
    expect(res.status).toBe(200);
    expect(mockDeleteChat).toHaveBeenCalledWith("test-user", "c1");
  });
});
