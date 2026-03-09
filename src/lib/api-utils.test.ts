import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { getUserId, isValidId, sanitizeFileName } from "./api-utils";

function createRequest(headers: Record<string, string>): NextRequest {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  return new Request("http://localhost", { headers: h }) as unknown as NextRequest;
}

describe("getUserId", () => {
  it("returns x-user-id when present and valid", () => {
    const req = createRequest({ "x-user-id": "user-123" });
    expect(getUserId(req)).toBe("user-123");
  });

  it("trims x-user-id", () => {
    const req = createRequest({ "x-user-id": "  user-456  " });
    expect(getUserId(req)).toBe("user-456");
  });

  it("returns default when header missing", () => {
    const req = createRequest({});
    expect(getUserId(req)).toBe("dev-user-1");
  });

  it("returns default when header empty after trim", () => {
    const req = createRequest({ "x-user-id": "   " });
    expect(getUserId(req)).toBe("dev-user-1");
  });

  it("truncates userId over MAX_USER_ID_LENGTH", () => {
    const long = "a".repeat(200);
    const req = createRequest({ "x-user-id": long });
    expect(getUserId(req).length).toBe(128);
  });
});

describe("isValidId", () => {
  it("accepts non-empty string", () => {
    expect(isValidId("chat-123")).toBe(true);
    expect(isValidId("a")).toBe(true);
  });

  it("rejects null and undefined", () => {
    expect(isValidId(null)).toBe(false);
    expect(isValidId(undefined)).toBe(false);
  });

  it("rejects empty or whitespace", () => {
    expect(isValidId("")).toBe(false);
    expect(isValidId("   ")).toBe(false);
  });

  it("rejects non-string", () => {
    expect(isValidId(123 as never)).toBe(false);
  });

  it("respects minLength", () => {
    expect(isValidId("a", 1)).toBe(true);
    expect(isValidId("", 1)).toBe(false);
    const minLen = 3;
    expect(isValidId("ab", minLen)).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("returns document.pdf for empty or whitespace", () => {
    expect(sanitizeFileName("")).toBe("document.pdf");
    expect(sanitizeFileName("   ")).toBe("document.pdf");
  });

  it("replaces invalid path chars", () => {
    expect(sanitizeFileName("a/b\\c?d.pdf")).toBe("a_b_c_d.pdf");
  });

  it("truncates to MAX_FILE_NAME_LENGTH", () => {
    const long = "a".repeat(300) + ".pdf";
    expect(sanitizeFileName(long).length).toBe(255);
  });

  it("preserves valid name", () => {
    expect(sanitizeFileName("Report 2024.pdf")).toBe("Report 2024.pdf");
  });
});
