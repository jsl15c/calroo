// Calendar Agent — read-only calendar queries and analysis.

import { callClaude, transformClaudeStream } from "@/server/ai/claude";
import { buildCalendarPrompt } from "./prompts/calendar-prompt";
import type { AgentContext, AgentResponse, HandoffSignal } from "./types";

export async function calendarAgent(
  ctx: AgentContext,
): Promise<AgentResponse> {
  const system = buildCalendarPrompt(ctx);
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

  // We need to peek at the stream to check for handoff signals.
  // Collect the first chunk; if it looks like JSON handoff, handle it.
  // Otherwise, pipe through as a streaming response.
  const [peekStream, passStream] = claudeStream.tee();

  const handoff = await tryParseHandoff(peekStream);
  if (handoff) {
    return { type: "handoff", signal: handoff };
  }

  return {
    type: "stream",
    stream: transformClaudeStream(passStream),
  };
}

/** Reads the entire stream to check if it's a handoff JSON signal. */
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
      // If we've collected enough to parse an SSE event, check it
      const combined = chunks.join("");
      if (combined.includes('"type":"handoff"')) {
        // Extract text from SSE data lines
        const text = extractTextFromSse(combined);
        if (text) {
          const parsed = tryParseJson(text);
          if (parsed?.type === "handoff") {
            return parsed as HandoffSignal;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

function extractTextFromSse(sseData: string): string {
  // Extract text_delta content from Claude's SSE format
  const texts: string[] = [];
  const lines = sseData.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6);
    try {
      const parsed = JSON.parse(data) as {
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
      // ignore
    }
  }
  return texts.join("");
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}
