// Scheduler Agent — proposes create/update/delete actions with confirmation cards.
// Never writes to Google Calendar directly — always returns a ConfirmationCard.

import type { ConfirmationCard } from "@/lib/types";
import { callClaude, transformClaudeStream } from "@/server/ai/claude";
import { buildSchedulerPrompt } from "./prompts/scheduler-prompt";
import type { AgentContext, AgentResponse, HandoffSignal } from "./types";

export async function schedulerAgent(
  ctx: AgentContext,
): Promise<AgentResponse> {
  const system = buildSchedulerPrompt(ctx);
  const messages = ctx.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Non-streaming first to check for structured JSON responses
  // (confirmation cards and handoffs are JSON, not prose)
  const result = await callClaude({
    system,
    messages,
    max_tokens: 2048,
    temperature: 0.5,
    stream: false,
    apiKey: ctx.apiKey,
  });

  const text = result.text.trim();

  // Check for confirmation card
  const confirmation = tryParseConfirmation(text);
  if (confirmation) {
    return { type: "confirmation", card: confirmation };
  }

  // Check for handoff
  const handoff = tryParseHandoff(text);
  if (handoff) {
    return { type: "handoff", signal: handoff };
  }

  // It's a clarifying question or prose — stream it as text
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Simulate streaming for UI consistency
      const sseEvent = `event: token\ndata: ${JSON.stringify({ text })}\n\n`;
      controller.enqueue(encoder.encode(sseEvent));
      controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      controller.close();
    },
  });

  return { type: "stream", stream };
}

function tryParseConfirmation(text: string): ConfirmationCard | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (
      parsed.type === "confirmation" &&
      parsed.card &&
      typeof parsed.card === "object"
    ) {
      return parsed.card as ConfirmationCard;
    }
  } catch {
    // not JSON
  }
  return null;
}

function tryParseHandoff(text: string): HandoffSignal | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (parsed.type === "handoff") {
      return parsed as unknown as HandoffSignal;
    }
  } catch {
    // not JSON
  }
  return null;
}
