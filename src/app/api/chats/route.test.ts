import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { GET, POST } from "./route";

vi.mock("@/lib/db", () => ({
  getChats: vi.fn(),
  createChat: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  getUserId: vi.fn(() => "test-user"),
}));

import { getChats, createChat } from "@/lib/db";

function createRequest(url = "http://localhost/api/chats", init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

describe("GET /api/chats", () => {
  beforeEach(() => {
    vi.mocked(getChats).mockReset();
  });

  it("returns 200 and chat list", async () => {
    vi.mocked(getChats).mockResolvedValue([
      { id: "c1", title: "Chat 1", updatedAt: "2024-01-01T00:00:00Z" },
    ]);
    const res = await GET(createRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "c1", title: "Chat 1" });
  });

  it("returns 500 when getChats throws", async () => {
    vi.mocked(getChats).mockRejectedValue(new Error("db error"));
    const res = await GET(createRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("POST /api/chats", () => {
  beforeEach(() => {
    vi.mocked(createChat).mockReset();
  });

  it("returns 200 and new chat", async () => {
    vi.mocked(createChat).mockResolvedValue({ id: "new-id", title: "New Chat" });
    const res = await POST(createRequest("http://localhost/api/chats", { method: "POST" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ id: "new-id", title: "New Chat" });
  });

  it("returns 500 when createChat throws", async () => {
    vi.mocked(createChat).mockRejectedValue(new Error("db error"));
    const res = await POST(createRequest("http://localhost/api/chats", { method: "POST" }));
    expect(res.status).toBe(500);
  });
});
