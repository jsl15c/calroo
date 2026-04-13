// GET  /api/calendar/events — fetch events from Google Calendar API
// POST /api/calendar/events — create a new event (after user confirmation)

import { z } from "zod";
import { requireSession } from "@/server/auth/middleware";
import {
  createEvent,
  fetchEvents,
  GoogleApiError,
  GoogleAuthError,
} from "@/server/calendar/google-calendar";

// ─── GET ─────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const sessionResult = await requireSession(request);
  if (!sessionResult) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { session, updatedCookie } = sessionResult;
  const url = new URL(request.url);

  // Default: 2 weeks back + 4 weeks forward
  const timeMin = new Date(
    url.searchParams.get("timeMin") ??
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  );
  const timeMax = new Date(
    url.searchParams.get("timeMax") ??
      new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
  );

  try {
    const events = await fetchEvents(session.accessToken, timeMin, timeMax);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (updatedCookie) headers["Set-Cookie"] = updatedCookie;

    return new Response(JSON.stringify({ events }), { status: 200, headers });
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return new Response("Unauthorized", { status: 401 });
    }
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof GoogleApiError ? err.status : 0;
    console.error("[calendar/events GET]", { status, message });
    return new Response(
      JSON.stringify({ error: "Failed to fetch calendar events", detail: message }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ─── POST (create) ────────────────────────────────────────

const CreateEventSchema = z.object({
  title: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  attendees: z.array(z.string().email()).default([]),
  description: z.string().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const sessionResult = await requireSession(request);
  if (!sessionResult) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { session, updatedCookie } = sessionResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid event payload",
        issues: parsed.error.issues,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const event = await createEvent(session.accessToken, parsed.data);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (updatedCookie) headers["Set-Cookie"] = updatedCookie;

    return new Response(JSON.stringify({ event }), { status: 201, headers });
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return new Response("Unauthorized", { status: 401 });
    }
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof GoogleApiError ? err.status : 0;
    console.error("[calendar/events POST]", { status, message });
    return new Response(
      JSON.stringify({ error: "Failed to create calendar event", detail: message }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
