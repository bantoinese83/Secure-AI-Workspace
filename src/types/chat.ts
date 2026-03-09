export type PdfState = "active" | "inactive";

export interface ChatPdf {
  id: string;
  fileName: string;
  s3Key: string;
  extractedText: string;
  state: PdfState;
  createdAt: string;
}

export interface Chat {
  id: string;
  title: string;
  instructionBox: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  order: number;
  createdAt: string;
}
