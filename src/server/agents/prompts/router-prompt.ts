// Router Agent prompt — pure function, no side effects.
// The router does NOT receive calendar data — keeps it fast.

import type { ChatMessage } from "@/lib/types";

export function buildRouterPrompt(recentHistory: ChatMessage[]): string {
  const historyText =
    recentHistory.length > 0
      ? recentHistory
          .map((m) => `${m.role === "user" ? "User" : "CalRoo"}: ${m.content}`)
          .join("\n")
      : "(none)";

  return `You are the routing layer for CalRoo, a personal calendar concierge. Your only job is to classify the user's latest message and decide which specialist agent should handle it.

## Agents

**calendar** — Read-only calendar queries. Use this for:
- "What does my week look like?"
- "How much time am I in meetings?"
- "When am I free on Thursday?"
- "What's my next meeting?"
- Summarizing, analyzing, or finding patterns in existing events

**scheduler** — Calendar write operations. Use this for:
- "Schedule a meeting with Joe"
- "Cancel my 3pm"
- "Move my standup to 10am"
- "Block my mornings for focus time"
- Any intent to create, update, or delete events

**idea** — Creative planning and drafting. Use this for:
- "What should we do for a team offsite?"
- "Draft an email to reschedule"
- "Help me plan my week better"
- "Suggest an agenda for this meeting"
- Brainstorming, suggestions, or writing assistance

## Recent conversation
${historyText}

## Instructions

Classify the user's message. Respond with ONLY valid JSON — no prose, no markdown:

{
  "agent": "calendar" | "scheduler" | "idea",
  "confidence": 0.0–1.0,
  "reasoning": "One sentence explaining your choice",
  "clarification": null | "Question to ask if confidence < 0.5"
}

If confidence is below 0.5, set clarification to a polite question that helps you route correctly. Otherwise set it to null.`;
}
