// Idea Agent — creative suggestions, planning, and email drafts.

import { callClaude, transformClaudeStream } from "@/server/ai/claude";
import { buildIdeaPrompt } from "./prompts/idea-prompt";
import type { AgentContext, AgentResponse, HandoffSignal } from "./types";

export async function ideaAgent(ctx: AgentContext): Promise<AgentResponse> {
  const system = buildIdeaPrompt(ctx);
  const messages = ctx.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const claudeStream = await callClaude({
    system,
    messages,
    max_tokens: 2048,
    temperature: 0.7,
    stream: true,
    apiKey: ctx.apiKey,
  });

  const [peekStream, passStream] = claudeStream.tee();
  const handoff = await tryParseHandoffFromStream(peekStream);

  if (handoff) {
    return { type: "handoff", signal: handoff };
  }

  return {
    type: "stream",
    stream: transformClaudeStream(passStream),
  };
}

async function tryParseHandoffFromStream(
  stream: ReadableStream<Uint8Array>,
): Promise<HandoffSignal | null> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
      const combined = chunks.join("");
      if (combined.includes('"type":"handoff"')) {
        const text = extractTextFromSse(combined);
        if (text) {
          try {
            const parsed = JSON.parse(text.trim()) as Record<string, unknown>;
            if (parsed.type === "handoff") return parsed as unknown as HandoffSignal;
          } catch {
            // not yet complete JSON
          }
        }
      }
    }
  } catch {
    // ignore read errors
  }

  return null;
}

function extractTextFromSse(sseData: string): string {
  const texts: string[] = [];
  for (const line of sseData.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const parsed = JSON.parse(line.slice(6)) as {
        type: string;
        delta?: { type: string; text: string };
      };
      if (
        parsed.type === "content_block_delta" &&
        parsed.delta?.type === "text_delta"
      ) {
        texts.push(parsed.delta.text);
      }
    } catch {
      // skip
    }
  }
  return texts.join("");
}
