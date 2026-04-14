// Router Agent — classifies intent, returns target agent + confidence.
// Fast: no streaming, no calendar data, short output.

import type { ChatMessage } from "@/lib/types";
import { callClaude } from "@/server/ai/claude";
import { buildRouterPrompt } from "./prompts/router-prompt";
import type { RouterResult } from "./types";

export async function routerAgent(
  message: string,
  recentHistory: ChatMessage[],
  apiKey: string,
): Promise<RouterResult> {
  const system = buildRouterPrompt(recentHistory);

  const result = await callClaude({
    system,
    messages: [{ role: "user", content: message }],
    max_tokens: 256,
    temperature: 0.2,
    stream: false,
    apiKey,
  });

  return parseRouterResponse(result.text);
}

/** Parses the router JSON response with a sensible fallback.
 *  Strips <think>...</think> reasoning blocks before parsing. */
export function parseRouterResponse(raw: string): RouterResult {
  // Strip reasoning model thinking blocks
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Strip markdown code fences
  const cleaned = withoutThinking
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // Extract the first {...} JSON object if there's surrounding prose
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;

  try {
    const parsed = JSON.parse(jsonStr) as Partial<RouterResult>;

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
    return {
      agent: "calendar",
      confidence: 0.4,
      reasoning: "Router response could not be parsed",
      clarification:
        "I want to make sure I help you correctly — are you looking to check your schedule, make a change, or brainstorm ideas?",
    };
  }
}
