/**
 * Centralized constants for the application.
 * User-facing messages are kept friendly and free of technical jargon.
 */

/** Design tokens */
export const COLORS = {
  background: "#0a0a0a",
  surface: "#0d0d0d",
  border: "border-zinc-800/80",
} as const;

/** User-facing error messages */
export const MESSAGES = {
  auth: {
    notConfigured:
      "Authentication is not configured. Set Cognito environment variables to enable login.",
    signInFailed: "Sign-in failed. Please check your email and password.",
    generic: "Something went wrong. Please try again.",
  },
  chat: {
    loadFailed: "Could not load chats.",
    createFailed: "Could not create a new chat.",
    updateFailed: "Could not update the chat.",
    deleteFailed: "Could not delete the chat.",
    notFound: "Chat not found.",
  },
  message: {
    sendFailed: "Could not send your message. Please try again.",
    streamError: "The response was interrupted. Please try again.",
  },
  pdf: {
    uploadFailed: "Could not upload the document.",
    updateFailed: "Could not update the document.",
    removeFailed: "Could not remove the document.",
  },
  empty: {
    noChats: "No chats yet",
    noChatsHint: "Create your first chat to get started",
    copyFailed: "Could not copy to clipboard.",
    selectChat: "Select a chat or create a new one",
    startConversation: "Start a conversation",
    startHint: "Type a message below. You can attach PDFs in the right panel.",
    noPdfs: "No documents attached",
    noPdfsHint: "Upload a PDF to use it as context",
    selectChatForPdfs: "Select a chat to attach PDFs",
  },
} as const;

/**
 * Base system prompt for Claude - used when invoking Bedrock.
 * Message assembly: base prompt + instruction box + active PDFs + recent conversation + user message.
 */
export const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant working inside a private single-user workspace.
Follow the current chat instructions provided by the user.
Use only the PDFs marked Active for this chat.
Ignore PDFs marked Inactive.
If the user asks to edit pasted text, focus only on the pasted text unless the user explicitly asks you to reference an attached PDF.
Use web search only when web results are explicitly provided for this turn.
Be clear, accurate, and concise.`;

/** Web search trigger phrases (case-insensitive) */
export const WEB_SEARCH_PATTERNS = [
  /search\s+the\s+web/i,
  /use\s+web\s+search/i,
  /search\s+the\s+internet/i,
  /look\s+up\s+online/i,
] as const;

/** Validation limits for API and DB */
export const LIMITS = {
  /** Max length of a single chat message (characters) */
  MAX_MESSAGE_LENGTH: 100_000,
  /** Max length of chat title */
  MAX_TITLE_LENGTH: 500,
  /** Max length of instruction box */
  MAX_INSTRUCTION_BOX_LENGTH: 10_000,
  /** Max length of PDF file name for display/storage */
  MAX_FILE_NAME_LENGTH: 255,
  /** Min length for chatId / pdfId (UUID is 36) */
  MIN_ID_LENGTH: 1,
  /** Max length for userId (Cognito sub is 36; allow some margin) */
  MAX_USER_ID_LENGTH: 128,
} as const;
