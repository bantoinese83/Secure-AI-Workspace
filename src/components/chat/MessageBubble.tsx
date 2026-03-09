"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import type { Message } from "@/types/chat";

interface MessageBubbleProps {
  message: Message;
  onCopy: (text: string) => void;
}

export const MessageBubble = memo(function MessageBubble({ message, onCopy }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={isUser ? "message-user" : "message-assistant"}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm transition-shadow duration-200 ${
          isUser
            ? "bg-zinc-700/90 text-zinc-100"
            : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/50"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        {!isUser && message.content && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-2 h-7 w-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded-md transition-colors"
            onClick={() => onCopy(message.content)}
            aria-label="Copy response"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
