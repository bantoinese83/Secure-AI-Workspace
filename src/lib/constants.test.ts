import { describe, it, expect } from "vitest";
import { WEB_SEARCH_PATTERNS, LIMITS, BASE_SYSTEM_PROMPT } from "./constants";

describe("WEB_SEARCH_PATTERNS", () => {
  it("matches explicit web search phrases", () => {
    const matches = [
      "search the web for X",
      "use web search",
      "search the internet",
      "look up online",
      "SEARCH THE WEB",
    ];
    for (const text of matches) {
      const matched = WEB_SEARCH_PATTERNS.some((p) => p.test(text));
      expect(matched, `expected "${text}" to match`).toBe(true);
    }
  });

  it("does not match unrelated text", () => {
    const noMatch = ["hello", "search my documents", "web design"];
    for (const text of noMatch) {
      const matched = WEB_SEARCH_PATTERNS.some((p) => p.test(text));
      expect(matched, `expected "${text}" not to match`).toBe(false);
    }
  });
});

describe("LIMITS", () => {
  it("defines positive limits", () => {
    expect(LIMITS.MAX_MESSAGE_LENGTH).toBeGreaterThan(0);
    expect(LIMITS.MAX_TITLE_LENGTH).toBeGreaterThan(0);
    expect(LIMITS.MAX_INSTRUCTION_BOX_LENGTH).toBeGreaterThan(0);
    expect(LIMITS.MAX_FILE_NAME_LENGTH).toBeGreaterThan(0);
    expect(LIMITS.MIN_ID_LENGTH).toBeGreaterThanOrEqual(0);
    expect(LIMITS.MAX_USER_ID_LENGTH).toBeGreaterThan(0);
  });
});

describe("BASE_SYSTEM_PROMPT", () => {
  it("includes pasted text and PDF behavior", () => {
    expect(BASE_SYSTEM_PROMPT).toContain("pasted text");
    expect(BASE_SYSTEM_PROMPT).toContain("PDF");
  });

  it("includes web search guidance", () => {
    expect(BASE_SYSTEM_PROMPT.toLowerCase()).toContain("web");
  });
});
