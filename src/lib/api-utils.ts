/**
 * Shared utilities for API routes.
 */

import { NextRequest } from "next/server";
import { LIMITS } from "./constants";

const DEFAULT_USER_ID = "dev-user-1";

/** Control chars and newlines that are invalid in IDs */
const INVALID_ID_REGEX = /[\x00-\x1F\x7F]/;

export function getUserId(req: NextRequest): string {
  const raw = req.headers.get("x-user-id")?.trim() || DEFAULT_USER_ID;
  if (raw.length > LIMITS.MAX_USER_ID_LENGTH) return raw.slice(0, LIMITS.MAX_USER_ID_LENGTH);
  if (INVALID_ID_REGEX.test(raw)) return DEFAULT_USER_ID;
  return raw || DEFAULT_USER_ID;
}

export function isValidId(
  id: string | undefined | null,
  minLength: number = LIMITS.MIN_ID_LENGTH
): boolean {
  if (id == null || typeof id !== "string") return false;
  const trimmed = id.trim();
  return trimmed.length >= minLength && !INVALID_ID_REGEX.test(trimmed);
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "document.pdf";
  const sanitized = trimmed.replace(/[/\\?%*:|"<>]/g, "_").slice(0, LIMITS.MAX_FILE_NAME_LENGTH);
  return sanitized || "document.pdf";
}
