"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatStore } from "@/store/chat-store";
import { useAuth } from "@/contexts/AuthContext";
import { isAuthConfigured } from "@/lib/amplify-config";
import { MESSAGES } from "@/lib/constants";
import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ChatSidebarProps {
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
}

export function ChatSidebar({
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
}: ChatSidebarProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { chats, currentChatId, isLoadingChats } = useChatStore();
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleRenameOpen = (id: string, title: string) => {
    setRenameId(id);
    setRenameValue(title);
  };

  const handleRenameSubmit = () => {
    if (renameId && renameValue.trim()) {
      onRenameChat(renameId, renameValue.trim());
      setRenameId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch {
      // Auth not configured - redirect anyway
      router.replace("/login");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 bg-zinc-800 hover:bg-zinc-700 transition-colors duration-200"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        {isAuthConfigured() && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-zinc-400 hover:text-zinc-200"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 px-2">
        {isLoadingChats ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-zinc-800/50" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageSquare className="h-10 w-10 text-zinc-600" />
            <p className="text-sm text-zinc-500">{MESSAGES.empty.noChats}</p>
            <p className="text-xs text-zinc-600">{MESSAGES.empty.noChatsHint}</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-200 ${
                  currentChatId === chat.id
                    ? "border-l-2 border-zinc-400 bg-zinc-800/90 text-zinc-100"
                    : "border-l-2 border-transparent hover:bg-zinc-800/60"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-inset rounded"
                  onClick={() => onSelectChat(chat.id)}
                >
                  {chat.title}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900">
                    <DropdownMenuItem onClick={() => handleRenameOpen(chat.id, chat.title)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onDeleteChat(chat.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog open={!!renameId} onOpenChange={() => setRenameId(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Chat title"
            onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
