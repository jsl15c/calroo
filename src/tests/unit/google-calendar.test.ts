import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEvent,
  deleteEvent,
  fetchEvents,
  GoogleAuthError,
} from "@/server/calendar/google-calendar";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── fetchEvents ─────────────────────────────────────────

describe("fetchEvents", () => {
  it("maps raw Google API events to CalendarEvent type", async () => {
    const rawResponse = {
      items: [
        {
          id: "event_1",
          summary: "Team Standup",
          start: { dateTime: "2026-04-13T09:00:00-04:00" },
          end: { dateTime: "2026-04-13T09:30:00-04:00" },
          attendees: [
            { email: "alice@example.com" },
            { email: "bob@example.com" },
          ],
          recurringEventId: "recurring_base_id",
          status: "confirmed",
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(rawResponse),
      }),
    );

    const events = await fetchEvents(
      "mock_token",
      new Date("2026-04-13"),
      new Date("2026-04-20"),
    );

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("event_1");
    expect(events[0].title).toBe("Team Standup");
    expect(events[0].start).toBe("2026-04-13T09:00:00-04:00");
    expect(events[0].end).toBe("2026-04-13T09:30:00-04:00");
    expect(events[0].attendees).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
    expect(events[0].recurring).toBe(true);
    expect(events[0].status).toBe("confirmed");
  });

  it("uses '(No title)' for events with no summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "e1",
                start: { dateTime: "2026-04-13T09:00:00Z" },
                end: { dateTime: "2026-04-13T10:00:00Z" },
              },
            ],
          }),
      }),
    );
    const events = await fetchEvents("token", new Date(), new Date());
    expect(events[0].title).toBe("(No title)");
  });

  it("throws GoogleAuthError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    await expect(
      fetchEvents("expired_token", new Date(), new Date()),
    ).rejects.toThrow(GoogleAuthError);
  });

  it("throws generic error on non-401 failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(fetchEvents("token", new Date(), new Date())).rejects.toThrow(
      "Google Calendar API error",
    );
  });

  it("returns empty array when items is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }),
    );
    const events = await fetchEvents("token", new Date(), new Date());
    expect(events).toEqual([]);
  });
});

// ─── createEvent ─────────────────────────────────────────

describe("createEvent", () => {
  it("returns a mapped CalendarEvent on success", async () => {
    const created = {
      id: "new_event_id",
      summary: "New Meeting",
      start: { dateTime: "2026-04-15T14:00:00-04:00" },
      end: { dateTime: "2026-04-15T14:30:00-04:00" },
      attendees: [{ email: "joe@example.com" }],
      status: "confirmed",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(created),
      }),
    );

    const event = await createEvent("token", {
      title: "New Meeting",
      start: "2026-04-15T14:00:00-04:00",
      end: "2026-04-15T14:30:00-04:00",
      attendees: ["joe@example.com"],
    });

    expect(event.id).toBe("new_event_id");
    expect(event.title).toBe("New Meeting");
  });

  it("throws GoogleAuthError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    await expect(
      createEvent("token", {
        title: "Test",
        start: "2026-04-15T14:00:00Z",
        end: "2026-04-15T15:00:00Z",
        attendees: [],
      }),
    ).rejects.toThrow(GoogleAuthError);
  });
});

// ─── deleteEvent ─────────────────────────────────────────

describe("deleteEvent", () => {
  it("resolves successfully on 204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204 }),
    );
    await expect(deleteEvent("token", "event_1")).resolves.toBeUndefined();
  });

  it("resolves silently on 404 (already deleted)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(deleteEvent("token", "event_1")).resolves.toBeUndefined();
  });

  it("throws GoogleAuthError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    await expect(deleteEvent("expired_token", "event_1")).rejects.toThrow(
      GoogleAuthError,
    );
  });
});
