/**
 * Tavily API for web search. Only called when user explicitly requests web search.
 */

import { tavily } from "@tavily/core";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "";

export function isTavilyConfigured() {
  return Boolean(TAVILY_API_KEY);
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export async function search(query: string, maxResults = 5): Promise<TavilyResult[]> {
  if (!TAVILY_API_KEY) return [];

  try {
    const client = tavily({ apiKey: TAVILY_API_KEY });
    const response = await client.search(query, {
      maxResults,
      searchDepth: "basic",
      includeAnswer: false,
    });

    const results = response.results ?? [];
    return results.map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: r.content ?? "",
    }));
  } catch {
    return [];
  }
}

export function formatTavilyResultsForContext(results: TavilyResult[]): string {
  if (results.length === 0) return "";

  return (
    "\n\nWeb search results:\n" +
    results.map((r) => `--- ${r.title} (${r.url}) ---\n${r.content}`).join("\n\n")
  );
}
