"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/types";
import { addDays, formatTimeRange, isSameDay, startOfMonth } from "@/lib/utils";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE_EVENTS = 3;

type CalendarMonthGridProps = {
  events: CalendarEvent[];
  monthOffset: number;
};

export function CalendarMonthGrid({
  events,
  monthOffset,
}: CalendarMonthGridProps) {
  const { weeks, monthStart } = useMemo(() => {
    const base = new Date();
    const monthStart = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    // Get the Monday of the week containing the 1st
    const firstDay = monthStart.getDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = firstDay === 0 ? -6 : 1 - firstDay;
    const gridStart = addDays(monthStart, diffToMonday);

    // Build 6 weeks (42 days) to always fill the grid
    const days: Date[] = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const weeks: Date[][] = [];
    for (let i = 0; i < 42; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return { weeks, monthStart };
  }, [monthOffset]);

  const today = new Date();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Day-of-week headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: "1px solid var(--color-cream)",
          flexShrink: 0,
        }}
      >
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            style={{
              padding: "var(--space-2) var(--space-3)",
              textAlign: "center",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-ink-soft)",
              borderLeft: "1px solid var(--color-cream)",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateRows: `repeat(${weeks.length}, 1fr)`,
          overflow: "hidden",
        }}
      >
        {weeks.map((week, wi) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: week rows are positional
            key={wi}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderTop: wi === 0 ? "none" : "1px solid var(--color-cream)",
            }}
          >
            {week.map((day) => {
              const isCurrentMonth = day.getMonth() === monthStart.getMonth();
              const isToday = isSameDay(day, today);
              const dayEvents = events.filter((e) => isSameDay(e.start, day));
              const overflowCount = Math.max(0, dayEvents.length - MAX_VISIBLE_EVENTS);
              const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);

              return (
                <div
                  key={day.toISOString()}
                  style={{
                    borderLeft: "1px solid var(--color-cream)",
                    padding: "var(--space-1) var(--space-2)",
                    overflow: "hidden",
                    backgroundColor: isToday
                      ? "color-mix(in srgb, var(--color-roo) 4%, transparent)"
                      : isCurrentMonth
                        ? "transparent"
                        : "color-mix(in srgb, var(--color-cream) 30%, transparent)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {/* Date number */}
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: isToday ? 600 : 400,
                      color: isToday
                        ? "var(--color-roo)"
                        : isCurrentMonth
                          ? "var(--color-ink)"
                          : "var(--color-ink-faint)",
                      fontFamily: isToday
                        ? "var(--font-dm-sans), sans-serif"
                        : "var(--font-playfair), serif",
                      lineHeight: 1.4,
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: isToday ? "var(--radius-full)" : undefined,
                      backgroundColor: isToday ? "var(--color-roo)" : undefined,
                      color: isToday ? "white" : undefined,
                      flexShrink: 0,
                    }}
                  >
                    {day.getDate()}
                  </div>

                  {/* Event pills */}
                  {visibleEvents.map((event) => (
                    <EventPill key={event.id} event={event} />
                  ))}

                  {/* Overflow indicator */}
                  {overflowCount > 0 && (
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-ink-soft)",
                        fontStyle: "italic",
                        paddingLeft: "2px",
                      }}
                    >
                      +{overflowCount} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

type EventPillProps = {
  event: CalendarEvent;
};

function EventPill({ event }: EventPillProps) {
  const isTentative = event.status === "tentative";

  return (
    <button
      type="button"
      title={`${event.title} · ${formatTimeRange(event.start, event.end)}`}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        backgroundColor: isTentative
          ? "var(--event-tentative)"
          : "var(--event-meeting)",
        borderLeft: `2px solid ${isTentative ? "var(--event-tentative-bar)" : "var(--event-meeting-bar)"}`,
        borderTop: "none",
        borderRight: "none",
        borderBottom: "none",
        borderRadius: "var(--radius-sm)",
        padding: "1px 4px",
        fontSize: "var(--text-xs)",
        fontWeight: 500,
        color: "var(--color-ink)",
        cursor: "default",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        lineHeight: 1.4,
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}
    >
      {event.title}
    </button>
  );
}
