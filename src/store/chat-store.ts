import { create } from "zustand";
import type { Chat, ChatPdf, Message } from "@/types/chat";

interface ChatStore {
  currentChatId: string | null;
  chats: { id: string; title: string; updatedAt: string }[];
  chatDetail: Chat | null;
  messages: Message[];
  pdfs: ChatPdf[];
  instructionBox: string;
  isLoadingChats: boolean;
  isLoadingChat: boolean;
  isStreaming: boolean;
  streamingContent: string;

  setCurrentChatId: (id: string | null) => void;
  setChats: (chats: { id: string; title: string; updatedAt: string }[]) => void;
  setChatDetail: (chat: Chat | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  updateLastMessage: (content: string) => void;
  setPdfs: (pdfs: ChatPdf[]) => void;
  updatePdfState: (pdfId: string, state: "active" | "inactive") => void;
  removePdfFromList: (pdfId: string) => void;
  addPdf: (pdf: ChatPdf) => void;
  setInstructionBox: (text: string) => void;
  setLoadingChats: (v: boolean) => void;
  setLoadingChat: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setStreamingContent: (v: string) => void;
  appendStreamingContent: (v: string) => void;
  resetForNewChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  currentChatId: null,
  chats: [],
  chatDetail: null,
  messages: [],
  pdfs: [],
  instructionBox: "",
  isLoadingChats: false,
  isLoadingChat: false,
  isStreaming: false,
  streamingContent: "",

  setCurrentChatId: (id) => set({ currentChatId: id }),
  setChats: (chats) => set({ chats }),
  setChatDetail: (chat) => set({ chatDetail: chat }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content };
      }
      return { messages: msgs };
    }),
  setPdfs: (pdfs) => set({ pdfs }),
  updatePdfState: (pdfId, state) =>
    set((s) => ({
      pdfs: s.pdfs.map((p) => (p.id === pdfId ? { ...p, state } : p)),
    })),
  removePdfFromList: (pdfId) => set((s) => ({ pdfs: s.pdfs.filter((p) => p.id !== pdfId) })),
  addPdf: (pdf) => set((s) => ({ pdfs: [...s.pdfs, pdf] })),
  setInstructionBox: (text) => set({ instructionBox: text }),
  setLoadingChats: (v) => set({ isLoadingChats: v }),
  setLoadingChat: (v) => set({ isLoadingChat: v }),
  setStreaming: (v) => set({ isStreaming: v }),
  setStreamingContent: (v) => set({ streamingContent: v }),
  appendStreamingContent: (v) => set((s) => ({ streamingContent: s.streamingContent + v })),
  resetForNewChat: () =>
    set({
      chatDetail: null,
      messages: [],
      pdfs: [],
      instructionBox: "",
      streamingContent: "",
      isStreaming: false,
    }),
}));
