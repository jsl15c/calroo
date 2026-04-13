// Router Agent — classifies intent, returns target agent + confidence.
// Fast: no streaming, no calendar data, short output.

import type { ChatMessage } from "@/lib/types";
import { type AiBinding, callClaude } from "@/server/ai/claude";
import { buildRouterPrompt } from "./prompts/router-prompt";
import type { RouterResult } from "./types";

export async function routerAgent(
  message: string,
  recentHistory: ChatMessage[],
  apiKey: string | null,
  gatewayUrl?: string | null,
  aiBinding?: AiBinding | null,
): Promise<RouterResult & { inputTokens: number; outputTokens: number }> {
  const system = buildRouterPrompt(recentHistory);

  const result = await callClaude({
    system,
    messages: [{ role: "user", content: message }],
    max_tokens: 200,
    temperature: 0.2,
    stream: false,
    apiKey,
    gatewayUrl,
    aiBinding,
  });

  return {
    ...parseRouterResponse(result.text),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

/** Parses Claude's JSON router response with a sensible fallback. */
export function parseRouterResponse(raw: string): RouterResult {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<RouterResult>;

    const agent = (["calendar", "scheduler", "idea"] as const).includes(
      parsed.agent as "calendar" | "scheduler" | "idea",
    )
      ? (parsed.agent as RouterResult["agent"])
      : "calendar";

    return {
      agent,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.5,
      reasoning:
        typeof parsed.reasoning === "string"
          ? parsed.reasoning
          : "Unable to determine routing",
      clarification:
        typeof parsed.clarification === "string" ? parsed.clarification : null,
    };
  } catch {
    // Fallback: default to calendar agent with low confidence
    return {
      agent: "calendar",
      confidence: 0.4,
      reasoning: "Router response could not be parsed",
      clarification:
        "I want to make sure I help you correctly — are you looking to check your schedule, make a change, or brainstorm ideas?",
    };
  }
}
