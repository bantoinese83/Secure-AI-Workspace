"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore } from "@/store/chat-store";
import { useAuth } from "@/contexts/AuthContext";
import { createApiClient } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MESSAGES, WEB_SEARCH_PATTERNS } from "@/lib/constants";

function detectWebSearch(text: string): boolean {
  return WEB_SEARCH_PATTERNS.some((p) => p.test(text));
}

export function ChatPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const { user, getToken } = useAuth();
  const toast = useToast();
  const getUserId = useCallback(() => user?.userId ?? "dev-user-1", [user?.userId]);
  const api = useMemo(() => createApiClient(getToken, getUserId), [getToken, getUserId]);
  const {
    currentChatId,
    messages,
    isStreaming,
    streamingContent,
    setStreaming,
    setStreamingContent,
    addMessage,
    updateLastMessage,
    appendStreamingContent,
    isLoadingChat,
  } = useChatStore();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleCopy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        toast.showError(MESSAGES.empty.copyFailed);
      }
    },
    [toast]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || !currentChatId) return;

      setInput("");
      addMessage({
        id: "",
        role: "user",
        content: text,
        order: messages.length,
        createdAt: "",
      });

      setStreaming(true);
      setStreamingContent("");
      let fullContent = "";

      try {
        await api.streamChat(
          currentChatId,
          text,
          { useWebSearch: detectWebSearch(text) },
          (chunk) => {
            fullContent += chunk;
            appendStreamingContent(chunk);
          },
          () => {
            setStreaming(false);
            if (fullContent) {
              updateLastMessage(fullContent);
            }
            setStreamingContent("");
          },
          () => {
            setStreaming(false);
            setStreamingContent("");
          }
        );
      } catch {
        setStreaming(false);
        setStreamingContent("");
        toast.showError(MESSAGES.message.sendFailed);
      }
    },
    [
      api,
      currentChatId,
      input,
      messages.length,
      addMessage,
      appendStreamingContent,
      setStreaming,
      setStreamingContent,
      updateLastMessage,
      toast,
    ]
  );

  const displayMessages = [...messages];
  if (isStreaming && streamingContent) {
    displayMessages.push({
      id: "streaming",
      role: "assistant",
      content: streamingContent,
      order: displayMessages.length,
      createdAt: "",
    });
  }

  const noChat = !currentChatId;
  const isEmpty = !isLoadingChat && displayMessages.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1 p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {noChat && !isLoadingChat && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <p className="text-zinc-400 text-base">{MESSAGES.empty.selectChat}</p>
            </div>
          )}

          {currentChatId && isEmpty && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <p className="text-zinc-400 text-base">{MESSAGES.empty.startConversation}</p>
              <p className="text-sm text-zinc-500 max-w-sm">{MESSAGES.empty.startHint}</p>
            </div>
          )}

          {displayMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onCopy={handleCopy} />
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-zinc-800/80 p-4 bg-[#0a0a0a]/50">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[44px] resize-none bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:border-zinc-600 transition-colors rounded-xl"
              rows={1}
              disabled={!currentChatId || isStreaming}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              disabled={!currentChatId || !input.trim() || isStreaming}
              className="shrink-0 rounded-xl transition-all duration-200 hover:brightness-110 disabled:opacity-50"
            >
              Send
            </Button>
          </div>
          {detectWebSearch(input) && (
            <p className="mt-2 text-xs text-zinc-500">Web search will be used for this message</p>
          )}
        </form>
      </div>
    </div>
  );
}
