"use client";

import { useCallback, useMemo, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
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
import { createApiClient } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { MESSAGES } from "@/lib/constants";
import { FileText, Upload, MoreHorizontal, Check, X, Trash2 } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

export function RightPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, getToken } = useAuth();
  const toast = useToast();
  const getUserId = useCallback(() => user?.userId ?? "dev-user-1", [user?.userId]);
  const api = useMemo(() => createApiClient(getToken, getUserId), [getToken, getUserId]);
  const {
    currentChatId,
    instructionBox,
    setInstructionBox,
    pdfs,
    updatePdfState,
    removePdfFromList,
    addPdf,
  } = useChatStore();

  const saveInstructionBox = useDebouncedCallback(async (text: string) => {
    if (!currentChatId) return;
    try {
      await api.updateChat(currentChatId, { instructionBox: text });
    } catch {
      toast.showError(MESSAGES.chat.updateFailed);
    }
  }, 500);

  const handleInstructionChange = (text: string) => {
    setInstructionBox(text);
    saveInstructionBox(text);
  };

  const handleUpload = useCallback(async () => {
    if (!currentChatId) return;
    const input = fileInputRef.current;
    if (!input) return;
    const file = input.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return;

    try {
      const { id, fileName } = await api.uploadPdf(currentChatId, file);
      addPdf({
        id,
        fileName,
        s3Key: "",
        extractedText: "",
        state: "active",
        createdAt: new Date().toISOString(),
      });
      input.value = "";
    } catch {
      toast.showError(MESSAGES.pdf.uploadFailed);
    }
  }, [currentChatId, api, addPdf, toast]);

  const handleRemovePdf = useCallback(
    async (pdfId: string) => {
      if (!currentChatId) return;
      try {
        await api.removePdf(currentChatId, pdfId);
        removePdfFromList(pdfId);
      } catch {
        toast.showError(MESSAGES.pdf.removeFailed);
      }
    },
    [currentChatId, api, removePdfFromList, toast]
  );

  const handleToggleState = useCallback(
    async (pdfId: string, state: "active" | "inactive") => {
      if (!currentChatId) return;
      try {
        await api.updatePdfState(currentChatId, pdfId, state);
        updatePdfState(pdfId, state);
      } catch {
        toast.showError(MESSAGES.pdf.updateFailed);
      }
    },
    [currentChatId, api, updatePdfState, toast]
  );

  const noChat = !currentChatId;

  return (
    <div className="flex flex-col p-4">
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-zinc-400">Instructions</label>
        <Textarea
          value={instructionBox}
          onChange={(e) => handleInstructionChange(e.target.value)}
          placeholder="Enter instructions for this chat..."
          className="min-h-[120px] resize-none bg-zinc-900/80"
          disabled={noChat}
        />
        <p className="mt-1 text-xs text-zinc-600">
          These instructions apply to every response in this chat.
        </p>
      </div>

      <div className="flex-1">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-400">Documents</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={noChat}
            className="gap-1 border-zinc-700 hover:bg-zinc-800/80 transition-colors duration-200"
          >
            <Upload className="h-4 w-4" />
            Upload PDF
          </Button>
        </div>

        <ScrollArea className="h-[200px]">
          {noChat ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <FileText className="h-10 w-10 text-zinc-600" />
              <p className="text-sm text-zinc-500">{MESSAGES.empty.selectChatForPdfs}</p>
            </div>
          ) : pdfs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <FileText className="h-10 w-10 text-zinc-600" />
              <p className="text-sm text-zinc-500">{MESSAGES.empty.noPdfs}</p>
              <p className="text-xs text-zinc-600">{MESSAGES.empty.noPdfsHint}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 transition-colors hover:border-zinc-700"
                >
                  <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                  <span className="min-w-0 flex-1 truncate text-sm">{pdf.fileName}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                      pdf.state === "active"
                        ? "bg-zinc-700 text-zinc-200"
                        : "bg-zinc-800/60 text-zinc-500"
                    }`}
                    title={pdf.state === "active" ? "Included in chat" : "Excluded from chat"}
                  >
                    {pdf.state === "active" ? "Active" : "Inactive"}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-700">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900">
                      <DropdownMenuItem
                        onClick={() =>
                          handleToggleState(pdf.id, pdf.state === "active" ? "inactive" : "active")
                        }
                      >
                        {pdf.state === "active" ? (
                          <>
                            <X className="mr-2 h-4 w-4" />
                            Mark Inactive
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Mark Active
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleRemovePdf(pdf.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
