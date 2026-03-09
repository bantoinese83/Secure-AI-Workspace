/**
 * PDF text extraction using unpdf (serverless-compatible).
 */

import { extractText, getDocumentProxy } from "unpdf";

export async function extractTextFromPdf(buffer: Buffer | Uint8Array): Promise<string> {
  try {
    const data = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    return text ?? "";
  } catch {
    return "";
  }
}
