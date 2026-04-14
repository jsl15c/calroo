// Scheduler Agent — proposes create/update/delete actions with confirmation cards.
// Never writes to Google Calendar directly — always returns a ConfirmationCard.

import type { ConfirmationCard } from "@/lib/types";
import { callClaude } from "@/server/ai/claude";
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

  // Non-streaming: confirmation cards and handoffs are JSON, not prose
  const result = await callClaude({
    system,
    messages,
    max_tokens: 800,
    temperature: 0.5,
    stream: false,
    apiKey: ctx.apiKey,
  });

  const text = result.text.trim();

  const confirmation = tryParseConfirmation(text);
  if (confirmation) {
    return { type: "confirmation", card: confirmation };
  }

  const handoff = tryParseHandoff(text);
  if (handoff) {
    return { type: "handoff", signal: handoff };
  }

  // Clarifying question or prose — wrap as a minimal SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: token\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: {}\n\n`,
        ),
      );
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
