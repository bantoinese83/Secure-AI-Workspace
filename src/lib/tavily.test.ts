import { describe, it, expect } from "vitest";
import { formatTavilyResultsForContext, type TavilyResult } from "./tavily";

describe("formatTavilyResultsForContext", () => {
  it("returns empty string for empty array", () => {
    expect(formatTavilyResultsForContext([])).toBe("");
  });

  it("formats single result", () => {
    const results: TavilyResult[] = [
      { title: "Example", url: "https://example.com", content: "Some content." },
    ];
    const out = formatTavilyResultsForContext(results);
    expect(out).toContain("Web search results");
    expect(out).toContain("Example");
    expect(out).toContain("https://example.com");
    expect(out).toContain("Some content.");
  });

  it("formats multiple results with separator", () => {
    const results: TavilyResult[] = [
      { title: "A", url: "https://a.com", content: "Content A" },
      { title: "B", url: "https://b.com", content: "Content B" },
    ];
    const out = formatTavilyResultsForContext(results);
    expect(out).toContain("--- A (https://a.com) ---");
    expect(out).toContain("Content A");
    expect(out).toContain("--- B (https://b.com) ---");
    expect(out).toContain("Content B");
  });
});
