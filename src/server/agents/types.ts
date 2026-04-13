// Agent-internal types — server-only.

import type { CalendarEvent, ChatMessage, ConfirmationCard } from "@/lib/types";

export type AgentName = "calendar" | "scheduler" | "idea";

export type RouterResult = {
  agent: AgentName;
  confidence: number; // 0.0–1.0
  reasoning: string;
  clarification: string | null; // non-null when confidence < 0.5
};

export type HandoffSignal = {
  type: "handoff";
  from: AgentName;
  to: AgentName;
  reason: string;
  context: Record<string, unknown>;
};

export type AgentResponse =
  | { type: "stream"; stream: ReadableStream<Uint8Array> }
  | { type: "handoff"; signal: HandoffSignal }
  | { type: "confirmation"; card: ConfirmationCard };

export type AgentContext = {
  messages: ChatMessage[]; // conversation history
  events: CalendarEvent[]; // calendar data (pre-fetched by orchestrator)
  user: { name: string; email: string; timezone: string };
  now: string; // ISO timestamp
  routerReasoning: string;
  routerConfidence: number;
  apiKey: string; // Anthropic API key passed from env
};
