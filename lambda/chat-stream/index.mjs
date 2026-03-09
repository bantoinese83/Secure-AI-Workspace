/**
 * Lambda handler for streaming chat - invokes Bedrock Claude with response stream.
 * Deploy to AWS Lambda and connect via API Gateway.
 *
 * Requires: @aws-sdk/client-bedrock-runtime
 * Env: TAVILY_API_KEY (optional, for web search)
 */

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant working inside a private single-user workspace.
Follow the current chat instructions provided by the user.
Use only the PDFs marked Active for this chat.
Ignore PDFs marked Inactive.
If the user asks to edit pasted text, focus only on the pasted text unless the user explicitly asks you to reference an attached PDF.
Use web search only when web results are explicitly provided for this turn.
Be clear, accurate, and concise.`;

function detectWebSearchRequest(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes("search the web") ||
    lower.includes("use web search") ||
    lower.includes("search the internet") ||
    lower.includes("look up online")
  );
}

export const handler = async (event) => {
  // TODO: Implement Lambda handler
  // 1. Parse request (chatId, message, useWebSearch)
  // 2. Fetch chat, instruction box, active PDFs, recent messages from DynamoDB
  // 3. If useWebSearch: call Tavily API, add results to context
  // 4. Invoke Bedrock InvokeModelWithResponseStream
  // 5. Stream chunks back to client
  return { statusCode: 501, body: "Not implemented - use Next.js API for dev" };
};
