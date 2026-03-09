import { describe, it, expect, beforeEach } from "vitest";
import { mockDb } from "./mock-db";

describe("mockDb", () => {
  beforeEach(() => {
    // Clear state by creating a fresh "session" - mockDb is a singleton, so we test its behavior
    // by creating chats and then operating on them.
    const chats = mockDb.getChats();
    for (const c of chats) {
      mockDb.deleteChat(c.id);
    }
  });

  describe("chats", () => {
    it("createChat returns id and title", () => {
      const { id, title } = mockDb.createChat();
      expect(id).toBeDefined();
      expect(title).toBe("New Chat");
    });

    it("getChats returns created chats sorted by updatedAt desc", () => {
      const a = mockDb.createChat();
      const b = mockDb.createChat();
      const list = mockDb.getChats();
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.find((c) => c.id === a.id)).toBeDefined();
      expect(list.find((c) => c.id === b.id)).toBeDefined();
    });

    it("getChat returns null for unknown id", () => {
      expect(mockDb.getChat("nonexistent")).toBeNull();
    });

    it("getChat returns chat after create", () => {
      const { id } = mockDb.createChat();
      const chat = mockDb.getChat(id);
      expect(chat).not.toBeNull();
      expect(chat?.id).toBe(id);
      expect(chat?.title).toBe("New Chat");
    });

    it("updateChat updates title and instructionBox", () => {
      const { id } = mockDb.createChat();
      const updated = mockDb.updateChat(id, {
        title: "Updated Title",
        instructionBox: "Custom instructions",
      });
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.instructionBox).toBe("Custom instructions");
      expect(mockDb.getChat(id)?.title).toBe("Updated Title");
    });

    it("deleteChat removes chat", () => {
      const { id } = mockDb.createChat();
      mockDb.deleteChat(id);
      expect(mockDb.getChat(id)).toBeNull();
    });
  });

  describe("messages", () => {
    it("addMessage appends to chat and returns message with id", () => {
      const { id: chatId } = mockDb.createChat();
      const msg = mockDb.addMessage(chatId, {
        role: "user",
        content: "Hello",
        order: 0,
      });
      expect(msg.id).toBeDefined();
      expect(msg.content).toBe("Hello");
      expect(msg.role).toBe("user");
      const list = mockDb.getMessages(chatId);
      expect(list.length).toBe(1);
      expect(list[0].content).toBe("Hello");
    });
  });

  describe("pdfs", () => {
    it("addPdf and getPdfs round-trip", () => {
      const { id: chatId } = mockDb.createChat();
      const pdf = mockDb.addPdf(chatId, {
        fileName: "doc.pdf",
        s3Key: "key",
        extractedText: "text",
        state: "active",
      });
      expect(pdf.id).toBeDefined();
      expect(pdf.fileName).toBe("doc.pdf");
      const list = mockDb.getPdfs(chatId);
      expect(list.length).toBe(1);
      expect(list[0].fileName).toBe("doc.pdf");
    });

    it("updatePdfState toggles state", () => {
      const { id: chatId } = mockDb.createChat();
      const pdf = mockDb.addPdf(chatId, {
        fileName: "x.pdf",
        s3Key: "",
        extractedText: "",
        state: "active",
      });
      const updated = mockDb.updatePdfState(chatId, pdf.id, "inactive");
      expect(updated?.state).toBe("inactive");
      mockDb.updatePdfState(chatId, pdf.id, "active");
      expect(mockDb.getPdfs(chatId)[0].state).toBe("active");
    });

    it("removePdf removes from list", () => {
      const { id: chatId } = mockDb.createChat();
      const pdf = mockDb.addPdf(chatId, {
        fileName: "x.pdf",
        s3Key: "",
        extractedText: "",
        state: "active",
      });
      mockDb.removePdf(chatId, pdf.id);
      expect(mockDb.getPdfs(chatId).length).toBe(0);
    });
  });
});
