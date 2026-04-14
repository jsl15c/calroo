// Idea Agent — creative suggestions, planning, and email drafts.

import {
  callClaude,
  extractTextFromStream,
  transformOpenRouterStream,
} from "@/server/ai/claude";
import { buildIdeaPrompt } from "./prompts/idea-prompt";
import type { AgentContext, AgentResponse, HandoffSignal } from "./types";

export async function ideaAgent(ctx: AgentContext): Promise<AgentResponse> {
  const system = buildIdeaPrompt(ctx);
  const messages = ctx.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const rawStream = await callClaude({
    system,
    messages,
    max_tokens: 800,
    temperature: 0.7,
    stream: true,
    apiKey: ctx.apiKey,
  });

  const [peekStream, passStream] = rawStream.tee();
  const handoff = await tryParseHandoff(peekStream);

  if (handoff) {
    return { type: "handoff", signal: handoff };
  }

  return { type: "stream", stream: transformOpenRouterStream(passStream) };
}

async function tryParseHandoff(
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
        const text = extractTextFromStream(combined);
        if (text) {
          try {
            const parsed = JSON.parse(text.trim()) as Record<string, unknown>;
            if (parsed.type === "handoff")
              return parsed as unknown as HandoffSignal;
          } catch {
            // not yet complete JSON
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}
