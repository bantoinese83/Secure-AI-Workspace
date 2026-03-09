/**
 * Amazon Bedrock Claude streaming.
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { AWS_REGION, BEDROCK_MODEL_ID, isAwsConfigured } from "./aws-config";

const client = new BedrockRuntimeClient({ region: AWS_REGION });

export async function* streamClaude(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string
): AsyncGenerator<string, void, unknown> {
  if (!isAwsConfigured()) return;

  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: [{ type: "text" as const, text: m.content }],
  }));

  const response = await client.send(
    new InvokeModelWithResponseStreamCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    })
  );

  const stream = response.body;
  if (!stream) return;

  const decoder = new TextDecoder();
  for await (const event of stream) {
    if (!("chunk" in event) || !event.chunk?.bytes) continue;
    try {
      const chunk = JSON.parse(decoder.decode(event.chunk.bytes)) as {
        type?: string;
        delta?: { text?: string };
      };
      if (chunk?.type === "content_block_delta" && typeof chunk.delta?.text === "string") {
        yield chunk.delta.text;
      }
    } catch {
      // skip malformed chunk
    }
  }
}
