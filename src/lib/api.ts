/**
 * API client for chat backend.
 * Uses NEXT_PUBLIC_API_URL when set (Lambda/API Gateway), otherwise /api for local dev.
 */

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "/api"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

async function getErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return "Something went wrong. Please try again.";
  try {
    const json = JSON.parse(text) as { error?: string; message?: string };
    return (
      (typeof json.error === "string" && json.error) ||
      (typeof json.message === "string" && json.message) ||
      "Something went wrong. Please try again."
    );
  } catch {
    return res.ok ? "Something went wrong. Please try again." : text.slice(0, 200);
  }
}

async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
  getToken: () => Promise<string | null>,
  getUserId: () => string
): Promise<Response> {
  const token = await getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-User-Id": getUserId(),
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export interface ApiClientOptions {
  getToken: () => Promise<string | null>;
  getUserId: () => string;
}

export function createApiClient(getToken: () => Promise<string | null>, getUserId: () => string) {
  return {
    async getChats(): Promise<{ id: string; title: string; updatedAt: string }[]> {
      const res = await fetchWithAuth("/chats", {}, getToken, getUserId);
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },

    async getChat(chatId: string) {
      if (!chatId?.trim()) throw new Error("Chat is required");
      const res = await fetchWithAuth(`/chats/${chatId}`, {}, getToken, getUserId);
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },

    async createChat(): Promise<{ id: string; title: string }> {
      const res = await fetchWithAuth("/chats", { method: "POST" }, getToken, getUserId);
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },

    async updateChat(chatId: string, data: { title?: string; instructionBox?: string }) {
      if (!chatId?.trim()) throw new Error("Chat is required");
      const res = await fetchWithAuth(
        `/chats/${chatId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
        getToken,
        getUserId
      );
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },

    async deleteChat(chatId: string) {
      if (!chatId?.trim()) throw new Error("Chat is required");
      const res = await fetchWithAuth(
        `/chats/${chatId}`,
        {
          method: "DELETE",
        },
        getToken,
        getUserId
      );
      if (!res.ok) throw new Error(await getErrorMessage(res));
    },

    async getMessages(chatId: string) {
      if (!chatId?.trim()) throw new Error("Chat is required");
      const res = await fetchWithAuth(`/chats/${chatId}/messages`, {}, getToken, getUserId);
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },

    async getPdfs(chatId: string) {
      if (!chatId?.trim()) throw new Error("Chat is required");
      const res = await fetchWithAuth(`/chats/${chatId}/pdfs`, {}, getToken, getUserId);
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },

    async uploadPdf(chatId: string, file: File): Promise<{ id: string; fileName: string }> {
      if (!chatId?.trim()) throw new Error("Chat is required");
      if (!file || !(file instanceof File)) throw new Error("A file is required");
      if (file.size === 0) throw new Error("File is empty");
      const formData = new FormData();
      formData.append("file", file);
      const token = await getToken();
      const headers: HeadersInit = {
        "X-User-Id": getUserId(),
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/chats/${chatId}/pdfs/upload`, {
        method: "POST",
        body: formData,
        headers,
      });
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },

    async getUploadUrl(chatId: string, fileName: string): Promise<{ url: string; pdfId: string }> {
      if (!chatId?.trim()) throw new Error("Chat is required");
      const res = await fetchWithAuth(
        `/chats/${chatId}/pdfs/upload-url`,
        {
          method: "POST",
          body: JSON.stringify({ fileName: fileName?.trim() || "document.pdf" }),
        },
        getToken,
        getUserId
      );
      if (!res.ok) throw new Error(await getErrorMessage(res));
      return res.json();
    },

    async updatePdfState(chatId: string, pdfId: string, state: "active" | "inactive") {
      if (!chatId?.trim() || !pdfId?.trim()) throw new Error("Chat and document are required");
      if (state !== "active" && state !== "inactive") throw new Error("Invalid state");
      const res = await fetchWithAuth(
        `/chats/${chatId}/pdfs/${pdfId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ state }),
        },
        getToken,
        getUserId
      );
      if (!res.ok) throw new Error(await getErrorMessage(res));
    },

    async removePdf(chatId: string, pdfId: string) {
      if (!chatId?.trim() || !pdfId?.trim()) throw new Error("Chat and document are required");
      const res = await fetchWithAuth(
        `/chats/${chatId}/pdfs/${pdfId}`,
        { method: "DELETE" },
        getToken,
        getUserId
      );
      if (!res.ok) throw new Error(await getErrorMessage(res));
    },

    async streamChat(
      chatId: string,
      message: string,
      options: { useWebSearch?: boolean },
      onChunk: (text: string) => void,
      onDone: () => void,
      onError: (err: Error) => void
    ) {
      if (!chatId?.trim()) {
        onError(new Error("Chat is required"));
        return;
      }
      const trimmedMessage = typeof message === "string" ? message.trim() : "";
      if (!trimmedMessage) {
        onError(new Error("Message cannot be empty"));
        return;
      }

      const res = await fetchWithAuth(
        `/chats/${chatId}/stream`,
        {
          method: "POST",
          body: JSON.stringify({
            message: trimmedMessage,
            useWebSearch: options.useWebSearch ?? false,
          }),
        },
        getToken,
        getUserId
      );

      if (!res.ok) {
        onError(new Error(await getErrorMessage(res)));
        onDone();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError(new Error("No response stream"));
        onDone();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data) as { text?: string; error?: string };
                if (typeof parsed.error === "string" && parsed.error) {
                  onError(new Error(parsed.error));
                  break;
                }
                if (typeof parsed.text === "string") onChunk(parsed.text);
              } catch {
                // skip invalid JSON
              }
            }
          }
        }
      } catch (err) {
        onError(
          err instanceof Error ? err : new Error("The response was interrupted. Please try again.")
        );
      } finally {
        onDone();
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
