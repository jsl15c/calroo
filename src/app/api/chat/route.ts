// POST /api/chat — orchestrator: router → agent → stream/confirmation.

import { z } from "zod";
import { env } from "@/lib/env";
import type { ChatMessage } from "@/lib/types";
import { calendarAgent } from "@/server/agents/calendar-agent";
import { ideaAgent } from "@/server/agents/idea-agent";
import { routerAgent } from "@/server/agents/router";
import { schedulerAgent } from "@/server/agents/scheduler-agent";
import type { AgentContext, AgentName } from "@/server/agents/types";
import { requireSession } from "@/server/auth/middleware";
import { fetchEvents } from "@/server/calendar/google-calendar";
import { Tracer } from "@/server/observability/tracer";

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.number(),
      }),
    )
    .max(50)
    .default([]),
  timezone: z.string().default("UTC"),
});

export async function POST(request: Request): Promise<Response> {
  // 1. Auth
  const sessionResult = await requireSession(request);
  if (!sessionResult) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { session, updatedCookie } = sessionResult;

  // 2. Validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request", 400);
  }

  const { message, history, timezone } = parsed.data;
  const apiKey = env.OPENROUTER_API_KEY;

  // 3. Start trace
  const trace = new Tracer(session.email.split("@")[0] ?? "user");

  try {
    // 4. Router Agent — classify intent
    const routerStart = Date.now();
    const recentHistory = history.slice(-3) as ChatMessage[];
    const routerResult = await routerAgent(message, recentHistory, apiKey);
    trace.step("router", {
      agent: routerResult.agent,
      confidence: routerResult.confidence,
      reasoning: routerResult.reasoning,
      duration_ms: Date.now() - routerStart,
    });

    // 5. Low confidence — return clarifying question directly
    if (routerResult.confidence < 0.5 && routerResult.clarification) {
      trace.finish();
      return sseResponse(routerResult.clarification, updatedCookie);
    }

    // 6. Fetch calendar events
    const calStart = Date.now();
    const now = new Date();
    const timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
    const events = await fetchEvents(session.accessToken, timeMin, timeMax);
    trace.step("calendar_fetch", {
      event_count: events.length,
      duration_ms: Date.now() - calStart,
      result: "success",
    });

    // 7. Build agent context
    const fullHistory = [
      ...history,
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: message,
        timestamp: Date.now(),
      },
    ] as ChatMessage[];

    const ctx: AgentContext = {
      messages: fullHistory,
      events,
      user: { name: session.name, email: session.email, timezone },
      now: now.toISOString(),
      routerReasoning: routerResult.reasoning,
      routerConfidence: routerResult.confidence,
      apiKey,
    };

    // 8. Dispatch to target agent
    let targetAgent = routerResult.agent;
    const agentStart = Date.now();
    let finalResponse = await dispatchAgent(targetAgent, ctx);
    trace.step("agent", {
      agent: targetAgent,
      duration_ms: Date.now() - agentStart,
      result: finalResponse.type,
    });

    // 9. Handle handoff (max 1)
    if (finalResponse.type === "handoff") {
      const signal = finalResponse.signal;
      trace.recordHandoff(signal.from, signal.to, signal.reason);

      const handoffStart = Date.now();
      finalResponse = await dispatchAgent(signal.to, ctx);
      trace.step("agent_handoff", {
        agent: signal.to,
        duration_ms: Date.now() - handoffStart,
        result: finalResponse.type,
      });
      targetAgent = signal.to;
    }

    // 10. Return response
    trace.finish();

    if (process.env.NODE_ENV === "development") {
      console.log(trace.pretty());
    }

    const responseHeaders: Record<string, string> = {};
    if (updatedCookie) responseHeaders["Set-Cookie"] = updatedCookie;

    if (finalResponse.type === "confirmation") {
      responseHeaders["Content-Type"] = "text/event-stream";
      responseHeaders["Cache-Control"] = "no-cache";
      responseHeaders.Connection = "keep-alive";

      const card = finalResponse.card;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const event = `event: confirmation\ndata: ${JSON.stringify(card)}\n\nevent: done\ndata: {}\n\n`;
          controller.enqueue(encoder.encode(event));
          controller.close();
        },
      });

      return new Response(stream, { status: 200, headers: responseHeaders });
    }

    if (finalResponse.type === "stream") {
      responseHeaders["Content-Type"] = "text/event-stream";
      responseHeaders["Cache-Control"] = "no-cache";
      responseHeaders.Connection = "keep-alive";
      return new Response(finalResponse.stream, {
        status: 200,
        headers: responseHeaders,
      });
    }

    return jsonError("Agent could not process request", 500);
  } catch (err) {
    trace.recordError("orchestrator", "UnexpectedError", "Internal error");
    trace.finish();
    console.error(
      "[chat] Unexpected error:",
      err instanceof Error ? err.message : err,
    );
    return jsonError("Internal server error", 500);
  }
}

// ─── Helpers ─────────────────────────────────────────────

async function dispatchAgent(name: AgentName, ctx: AgentContext) {
  switch (name) {
    case "calendar":
      return calendarAgent(ctx);
    case "scheduler":
      return schedulerAgent(ctx);
    case "idea":
      return ideaAgent(ctx);
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(text: string, updatedCookie: string | null): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: token\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: {}\n\n`,
        ),
      );
      controller.close();
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
  if (updatedCookie) headers["Set-Cookie"] = updatedCookie;

  return new Response(stream, { status: 200, headers });
}
