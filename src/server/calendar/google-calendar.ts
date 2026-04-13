// Google Calendar API client — read + write.
// Uses native fetch only (no Google SDK).
// Always maps raw responses to our CalendarEvent type before returning.

import type { CalendarEvent } from "@/lib/types";

const BASE_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// ─── Types for raw Google API shapes ─────────────────────
// These never leave this file.

type GoogleEventDateTime = {
  dateTime?: string;
  date?: string; // all-day events
  timeZone?: string;
};

type GoogleAttendee = {
  email: string;
  responseStatus?: string;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  attendees?: GoogleAttendee[];
  recurrence?: string[];
  recurringEventId?: string;
  status?: "confirmed" | "tentative" | "cancelled";
};

type GoogleEventListResponse = {
  items: GoogleEvent[];
  nextPageToken?: string;
};

// ─── Mapper ──────────────────────────────────────────────

function mapEvent(raw: GoogleEvent): CalendarEvent {
  return {
    id: raw.id,
    title: raw.summary ?? "(No title)",
    start: raw.start.dateTime ?? raw.start.date ?? "",
    end: raw.end.dateTime ?? raw.end.date ?? "",
    attendees: raw.attendees?.map((a) => a.email) ?? [],
    recurring: Boolean(raw.recurringEventId) || Boolean(raw.recurrence?.length),
    status: raw.status ?? "confirmed",
    description: raw.description,
  };
}

// ─── Read operations ──────────────────────────────────────

/** Fetches events for the given time window. */
export async function fetchEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const response = await fetch(`${BASE_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    throw new GoogleAuthError("Access token expired or invalid");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GoogleApiError(response.status, body);
  }

  const data = (await response.json()) as GoogleEventListResponse;
  return (data.items ?? []).map(mapEvent);
}

// ─── Write operations ─────────────────────────────────────

type CreateEventPayload = {
  title: string;
  start: string;
  end: string;
  attendees: string[];
  description?: string;
};

/** Creates a new calendar event. */
export async function createEvent(
  accessToken: string,
  payload: CreateEventPayload,
): Promise<CalendarEvent> {
  const body = {
    summary: payload.title,
    description: payload.description,
    start: { dateTime: payload.start },
    end: { dateTime: payload.end },
    attendees: payload.attendees.map((email) => ({ email })),
  };

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) throw new GoogleAuthError("Token expired");
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GoogleApiError(response.status, body);
  }

  return mapEvent((await response.json()) as GoogleEvent);
}

type UpdateEventPayload = Partial<CreateEventPayload>;

/** Updates an existing calendar event (only changed fields). */
export async function updateEvent(
  accessToken: string,
  eventId: string,
  payload: UpdateEventPayload,
): Promise<CalendarEvent> {
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body.summary = payload.title;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.start !== undefined) body.start = { dateTime: payload.start };
  if (payload.end !== undefined) body.end = { dateTime: payload.end };
  if (payload.attendees !== undefined)
    body.attendees = payload.attendees.map((email) => ({ email }));

  const response = await fetch(`${BASE_URL}/${eventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) throw new GoogleAuthError("Token expired");
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GoogleApiError(response.status, body);
  }

  return mapEvent((await response.json()) as GoogleEvent);
}

/** Deletes (cancels) a calendar event. */
export async function deleteEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) throw new GoogleAuthError("Token expired");
  if (response.status === 404) return; // already gone
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GoogleApiError(response.status, body);
  }
}

// ─── Error types ─────────────────────────────────────────

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export class GoogleApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    const parsed = GoogleApiError.parseBody(body);
    super(parsed ?? `Google Calendar API error: ${status}`);
    this.name = "GoogleApiError";
    this.status = status;
    this.body = body;
  }

  private static parseBody(body: string): string | null {
    try {
      const json = JSON.parse(body) as {
        error?: { message?: string; status?: string };
      };
      return json.error?.message ?? null;
    } catch {
      return null;
    }
  }
}
