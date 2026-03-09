/**
 * In-memory mock database for local development.
 * Replace with DynamoDB when deploying to AWS.
 */

import type { Chat, ChatPdf, Message } from "@/types/chat";

const userId = "dev-user-1";

const chats = new Map<string, Chat>();
const messagesByChat = new Map<string, Message[]>();
const pdfsByChat = new Map<string, ChatPdf[]>();

function generateId() {
  return crypto.randomUUID();
}

export const mockDb = {
  getChats() {
    return Array.from(chats.values())
      .filter(
        (c) =>
          (c as Chat & { userId?: string }).userId === userId ||
          !(c as Chat & { userId?: string }).userId
      )
      .map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getChat(id: string) {
    const chat = chats.get(id);
    if (!chat) return null;
    return chat;
  },

  createChat() {
    const now = new Date().toISOString();
    const chat: Chat & { userId?: string } = {
      id: generateId(),
      title: "New Chat",
      instructionBox: "",
      createdAt: now,
      updatedAt: now,
      userId,
    };
    chats.set(chat.id, chat);
    messagesByChat.set(chat.id, []);
    pdfsByChat.set(chat.id, []);
    return { id: chat.id, title: chat.title };
  },

  updateChat(id: string, data: { title?: string; instructionBox?: string }) {
    const chat = chats.get(id);
    if (!chat) return null;
    const updated = {
      ...chat,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    chats.set(id, updated);
    return updated;
  },

  deleteChat(id: string) {
    chats.delete(id);
    messagesByChat.delete(id);
    pdfsByChat.delete(id);
  },

  getMessages(chatId: string) {
    const msgs = messagesByChat.get(chatId) ?? [];
    return msgs.sort((a, b) => a.order - b.order);
  },

  addMessage(chatId: string, msg: Omit<Message, "id" | "createdAt">) {
    const msgs = messagesByChat.get(chatId) ?? [];
    const newMsg: Message = {
      ...msg,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    msgs.push(newMsg);
    messagesByChat.set(chatId, msgs);
    const chat = chats.get(chatId);
    if (chat) {
      chat.updatedAt = new Date().toISOString();
      chats.set(chatId, chat);
    }
    return newMsg;
  },

  getPdfs(chatId: string) {
    return pdfsByChat.get(chatId) ?? [];
  },

  addPdf(chatId: string, pdf: Omit<ChatPdf, "id" | "createdAt">, existingId?: string) {
    const pdfs = pdfsByChat.get(chatId) ?? [];
    const newPdf: ChatPdf = {
      ...pdf,
      id: existingId ?? generateId(),
      createdAt: new Date().toISOString(),
    };
    pdfs.push(newPdf);
    pdfsByChat.set(chatId, pdfs);
    return newPdf;
  },

  updatePdfState(chatId: string, pdfId: string, state: "active" | "inactive") {
    const pdfs = pdfsByChat.get(chatId) ?? [];
    const idx = pdfs.findIndex((p) => p.id === pdfId);
    if (idx >= 0) {
      pdfs[idx] = { ...pdfs[idx], state };
      pdfsByChat.set(chatId, pdfs);
      return pdfs[idx];
    }
    return null;
  },

  removePdf(chatId: string, pdfId: string) {
    const pdfs = pdfsByChat.get(chatId) ?? [];
    const filtered = pdfs.filter((p) => p.id !== pdfId);
    pdfsByChat.set(chatId, filtered);
  },
};
