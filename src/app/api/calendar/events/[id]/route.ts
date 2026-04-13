// PATCH /api/calendar/events/[id] — update an event (after confirmation)
// DELETE /api/calendar/events/[id] — delete an event (after confirmation)

import { z } from "zod";
import { requireSession } from "@/server/auth/middleware";
import {
  deleteEvent,
  GoogleAuthError,
  updateEvent,
} from "@/server/calendar/google-calendar";

type RouteContext = { params: Promise<{ id: string }> };

// ─── PATCH (update) ───────────────────────────────────────

const UpdateEventSchema = z.object({
  title: z.string().min(1).optional(),
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
  attendees: z.array(z.string().email()).optional(),
  description: z.string().optional(),
});

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const sessionResult = await requireSession(request);
  if (!sessionResult) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { session, updatedCookie } = sessionResult;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = UpdateEventSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid update payload",
        issues: parsed.error.issues,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const event = await updateEvent(session.accessToken, id, parsed.data);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (updatedCookie) headers["Set-Cookie"] = updatedCookie;

    return new Response(JSON.stringify({ event }), { status: 200, headers });
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return new Response("Unauthorized", { status: 401 });
    }
    console.error(
      "[calendar/events PATCH]",
      err instanceof Error ? err.message : err,
    );
    return new Response("Bad Gateway", { status: 502 });
  }
}

// ─── DELETE ───────────────────────────────────────────────

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const sessionResult = await requireSession(request);
  if (!sessionResult) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { session, updatedCookie } = sessionResult;
  const { id } = await context.params;

  try {
    await deleteEvent(session.accessToken, id);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (updatedCookie) headers["Set-Cookie"] = updatedCookie;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return new Response("Unauthorized", { status: 401 });
    }
    console.error(
      "[calendar/events DELETE]",
      err instanceof Error ? err.message : err,
    );
    return new Response("Bad Gateway", { status: 502 });
  }
}
