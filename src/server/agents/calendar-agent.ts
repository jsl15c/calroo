// Calendar Agent — read-only calendar queries and analysis.
// Supports on-demand calendar fetches via function calling when the user asks
// about a date range outside the pre-loaded window.

import {
  callClaude,
  type OpenRouterMessage,
  type OpenRouterTool,
  type OpenRouterToolCall,
  transformOpenRouterStream,
} from "@/server/ai/claude";
import { fetchEvents } from "@/server/calendar/google-calendar";
import { buildCalendarPrompt } from "./prompts/calendar-prompt";
import type { AgentContext, AgentResponse, HandoffSignal } from "./types";

// ─── Tool definition ──────────────────────────────────────────────────────────

const FETCH_CALENDAR_TOOL: OpenRouterTool = {
  type: "function",
  function: {
    name: "fetch_calendar_events",
    description:
      "Fetch calendar events for a specific date range. Call this when the user asks about a time period not covered by the pre-loaded events window (-14 days to +28 days from today). Pass ISO 8601 datetimes.",
    parameters: {
      type: "object",
      properties: {
        time_min: {
          type: "string",
          description:
            "Start of the range (ISO 8601, e.g. 2026-05-01T00:00:00Z)",
        },
        time_max: {
          type: "string",
          description: "End of the range (ISO 8601, e.g. 2026-05-07T23:59:59Z)",
        },
      },
      required: ["time_min", "time_max"],
    },
  },
};

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function calendarAgent(ctx: AgentContext): Promise<AgentResponse> {
  const system = buildCalendarPrompt(ctx);
  const conversationMessages: OpenRouterMessage[] = ctx.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Tool use loop — allow up to 2 rounds of fetches before forcing a final answer.
  const MAX_TOOL_ROUNDS = 2;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await callClaude({
      system,
      messages: conversationMessages,
      max_tokens: 400, // short — just for tool resolution, not the final answer
      temperature: 0.7,
      stream: false,
      apiKey: ctx.apiKey,
      tools: [FETCH_CALENDAR_TOOL],
    });

    // Check for a handoff signal in the text response.
    if (result.text) {
      const handoff = tryParseHandoff(result.text);
      if (handoff) return { type: "handoff", signal: handoff };
    }

    // No tool calls — model has enough data; break to final streaming call.
    if (result.toolCalls.length === 0) break;

    // Append the assistant message (with tool calls) to the conversation.
    conversationMessages.push({
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls,
    });

    // Execute each tool call and append the results.
    for (const toolCall of result.toolCalls) {
      const toolResult = await executeTool(toolCall, ctx.accessToken);
      conversationMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  // Final streaming call — model now has all the data it needs.
  const rawStream = await callClaude({
    system,
    messages: conversationMessages,
    max_tokens: 800,
    temperature: 0.7,
    stream: true,
    apiKey: ctx.apiKey,
  });

  // Peek at the stream to catch a handoff signal before piping to the client.
  const [peekStream, passStream] = rawStream.tee();
  const handoffFromStream = await tryParseHandoffFromStream(peekStream);
  if (handoffFromStream) return { type: "handoff", signal: handoffFromStream };

  return { type: "stream", stream: transformOpenRouterStream(passStream) };
}

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(
  toolCall: OpenRouterToolCall,
  accessToken: string,
): Promise<string> {
  if (toolCall.function.name !== "fetch_calendar_events") {
    return JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
  }

  try {
    const args = JSON.parse(toolCall.function.arguments) as {
      time_min: string;
      time_max: string;
    };
    const events = await fetchEvents(
      accessToken,
      new Date(args.time_min),
      new Date(args.time_max),
    );
    return JSON.stringify(events);
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : "Failed to fetch events",
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tryParseHandoff(text: string): HandoffSignal | null {
  try {
    const parsed = JSON.parse(text.trim()) as Record<string, unknown>;
    if (parsed.type === "handoff") return parsed as unknown as HandoffSignal;
  } catch {
    // not JSON / not a handoff
  }
  return null;
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
        // Extract text from SSE deltas and try to parse.
        const text = extractTextFromSSE(combined);
        const handoff = tryParseHandoff(text);
        if (handoff) return handoff;
      }
    }
  } catch {
    // ignore — stream errors are handled downstream
  }

  return null;
}

function extractTextFromSSE(sseData: string): string {
  const texts: string[] = [];
  for (const line of sseData.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as {
        choices: Array<{ delta?: { content?: string } }>;
      };
      const text = parsed.choices[0]?.delta?.content;
      if (text) texts.push(text);
    } catch {
      // skip
    }
  }
  return texts.join("");
}
