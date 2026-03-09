"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RightPanel } from "@/components/chat/RightPanel";
import { useAuth } from "@/contexts/AuthContext";
import { createApiClient } from "@/lib/api";
import { useChatStore } from "@/store/chat-store";
import useSWR from "swr";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PanelRight } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { MESSAGES } from "@/lib/constants";

export function WorkspaceLayout() {
  const [rightOpen, setRightOpen] = useState(false);
  const { user, getToken } = useAuth();
  const toast = useToast();
  const getUserId = useCallback(() => user?.userId ?? "dev-user-1", [user?.userId]);
  const api = useMemo(() => createApiClient(getToken, getUserId), [getToken, getUserId]);
  const {
    setChats,
    setLoadingChats,
    setCurrentChatId,
    currentChatId,
    setChatDetail,
    setMessages,
    setPdfs,
    setInstructionBox,
    setLoadingChat,
    resetForNewChat,
  } = useChatStore();

  const {
    data: chats,
    isLoading,
    mutate,
  } = useSWR(user ? "chats" : null, () => api.getChats(), { revalidateOnFocus: false });

  useEffect(() => {
    if (chats) {
      setChats(chats);
      setLoadingChats(false);
    } else if (isLoading) {
      setLoadingChats(true);
    }
  }, [chats, isLoading, setChats, setLoadingChats]);

  useEffect(() => {
    if (!currentChatId) return;
    setLoadingChat(true);
    Promise.all([
      api.getChat(currentChatId),
      api.getMessages(currentChatId),
      api.getPdfs(currentChatId),
    ])
      .then(([chat, messages, pdfs]) => {
        setChatDetail(chat);
        setMessages(messages);
        setPdfs(pdfs);
        setInstructionBox(chat.instructionBox ?? "");
      })
      .catch(() => {
        resetForNewChat();
        setCurrentChatId(null);
      })
      .finally(() => setLoadingChat(false));
  }, [
    currentChatId,
    api,
    setChatDetail,
    setMessages,
    setPdfs,
    setInstructionBox,
    setLoadingChat,
    resetForNewChat,
    setCurrentChatId,
  ]);

  const handleNewChat = useCallback(async () => {
    try {
      const { id } = await api.createChat();
      setCurrentChatId(id);
      resetForNewChat();
      setChatDetail({
        id,
        title: "New Chat",
        instructionBox: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setMessages([]);
      setPdfs([]);
      setInstructionBox("");
    } catch {
      toast.showError(MESSAGES.chat.createFailed);
    }
  }, [
    api,
    resetForNewChat,
    setChatDetail,
    setCurrentChatId,
    setMessages,
    setPdfs,
    setInstructionBox,
    toast,
  ]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setCurrentChatId(id);
    },
    [setCurrentChatId]
  );

  const handleDeleteChat = useCallback(
    async (id: string) => {
      try {
        await api.deleteChat(id);
        if (currentChatId === id) {
          setCurrentChatId(null);
          resetForNewChat();
        }
        await mutate();
      } catch {
        toast.showError(MESSAGES.chat.deleteFailed);
      }
    },
    [api, currentChatId, mutate, resetForNewChat, setCurrentChatId, toast]
  );

  const handleRenameChat = useCallback(
    async (id: string, title: string) => {
      try {
        await api.updateChat(id, { title });
        const { chatDetail } = useChatStore.getState();
        if (chatDetail?.id === id) {
          setChatDetail({ ...chatDetail, title });
        }
        await mutate();
      } catch {
        toast.showError(MESSAGES.chat.updateFailed);
      }
    },
    [api, mutate, setChatDetail, toast]
  );

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-zinc-100">
      <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-800/80 bg-[#0d0d0d] sm:w-64 shadow-[2px_0_24px_-4px_rgba(0,0,0,0.4)]">
        <ChatSidebar
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
        />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-800/80 px-4 py-2 xl:hidden">
          <Sheet open={rightOpen} onOpenChange={setRightOpen}>
            <SheetTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors duration-200">
              <PanelRight className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-80 border-zinc-800 bg-[#0d0d0d] p-0">
              <RightPanel />
            </SheetContent>
          </Sheet>
        </div>
        <ChatPanel />
      </main>
      <aside className="hidden w-80 shrink-0 flex-col border-l border-zinc-800/80 bg-[#0d0d0d] xl:flex shadow-[-2px_0_24px_-4px_rgba(0,0,0,0.4)]">
        <RightPanel />
      </aside>
    </div>
  );
}
