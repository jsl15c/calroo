"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/types";
import {
  addDays,
  eventPositionStyle,
  formatDayHeader,
  formatTimeRange,
  isSameDay,
  startOfWeek,
} from "@/lib/utils";

const HOUR_START = 7; // 7:00 AM
const HOUR_END = 21; // 9:00 PM
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START },
  (_, i) => HOUR_START + i,
);

type CalendarGridProps = {
  events: CalendarEvent[];
  weekOffset: number;
};

export function CalendarGrid({ events, weekOffset }: CalendarGridProps) {
  const weekDays = useMemo(() => {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(base, i));
  }, [weekOffset]);

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
      {/* Day headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "64px repeat(7, 1fr)",
          borderBottom: "1px solid var(--color-cream)",
          flexShrink: 0,
        }}
      >
        <div /> {/* Time column spacer */}
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          const { weekday, date } = formatDayHeader(day);
          return (
            <div
              key={day.toISOString()}
              style={{
                padding: "var(--space-3) var(--space-2)",
                textAlign: "center",
                borderLeft: "1px solid var(--color-cream)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: isToday ? "var(--color-roo)" : "var(--color-ink-soft)",
                }}
              >
                {weekday}
              </div>
              <div
                style={{
                  fontSize: "var(--text-lg)",
                  fontWeight: 400,
                  color: isToday ? "var(--color-roo)" : "var(--color-ink)",
                  fontFamily: "var(--font-playfair), serif",
                  lineHeight: 1.2,
                }}
              >
                {day.getDate()}
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: isToday
                    ? "var(--color-roo)"
                    : "var(--color-ink-faint)",
                }}
              >
                {date.split(" ")[0]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "64px repeat(7, 1fr)",
            minHeight: `${(HOUR_END - HOUR_START) * 60}px`,
            position: "relative",
          }}
        >
          {/* Time labels */}
          <div style={{ position: "relative" }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{
                  position: "absolute",
                  top: `${((hour - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%`,
                  right: "var(--space-2)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-ink-faint)",
                  transform: "translateY(-50%)",
                  whiteSpace: "nowrap",
                }}
              >
                {hour === 12
                  ? "12 PM"
                  : hour > 12
                    ? `${hour - 12} PM`
                    : `${hour} AM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            const dayEvents = events.filter((e) => isSameDay(e.start, day));

            return (
              <div
                key={day.toISOString()}
                style={{
                  borderLeft: "1px solid var(--color-cream)",
                  position: "relative",
                  backgroundColor: isToday
                    ? "color-mix(in srgb, var(--color-roo) 3%, transparent)"
                    : "transparent",
                }}
              >
                {/* Hour grid lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      position: "absolute",
                      top: `${((hour - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%`,
                      left: 0,
                      right: 0,
                      borderTop: "1px dashed var(--color-cream)",
                    }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={`${hour}-half`}
                    style={{
                      position: "absolute",
                      top: `${((hour - HOUR_START + 0.5) / (HOUR_END - HOUR_START)) * 100}%`,
                      left: 0,
                      right: 0,
                      borderTop: "1px dotted var(--color-cream)",
                      opacity: 0.5,
                    }}
                  />
                ))}

                {/* Empty state */}
                {dayEvents.length === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      right: 0,
                      textAlign: "center",
                      transform: "translateY(-50%)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-ink-faint)",
                      fontStyle: "italic",
                    }}
                  >
                    Clear skies
                  </div>
                )}

                {/* Current time indicator */}
                {isToday && <CurrentTimeIndicator />}

                {/* Event blocks */}
                {dayEvents.map((event) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    hourStart={HOUR_START}
                    hourEnd={HOUR_END}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const elapsedMinutes = (now.getHours() - HOUR_START) * 60 + now.getMinutes();
  const pct = Math.min(100, Math.max(0, (elapsedMinutes / totalMinutes) * 100));

  return (
    <div
      style={{
        position: "absolute",
        top: `${pct}%`,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: "var(--color-roo)",
          flexShrink: 0,
          marginLeft: "-4px",
        }}
      />
      <div
        style={{
          flex: 1,
          height: "1px",
          backgroundColor: "var(--color-roo)",
        }}
      />
    </div>
  );
}

type EventBlockProps = {
  event: CalendarEvent;
  hourStart: number;
  hourEnd: number;
};

function EventBlock({ event, hourStart, hourEnd }: EventBlockProps) {
  const pos = eventPositionStyle(event.start, event.end, hourStart, hourEnd);
  const isTentative = event.status === "tentative";

  return (
    <button
      type="button"
      title={`${event.title} · ${formatTimeRange(event.start, event.end)}`}
      style={{
        position: "absolute",
        top: pos.top,
        height: pos.height,
        left: "2px",
        right: "2px",
        backgroundColor: isTentative
          ? "var(--event-tentative)"
          : "var(--event-meeting)",
        borderLeft: `3px solid ${isTentative ? "var(--event-tentative-bar)" : "var(--event-meeting-bar)"}`,
        borderRadius: "var(--radius-sm)",
        padding: "2px 4px",
        overflow: "hidden",
        cursor: "default",
        boxShadow: "var(--shadow-sm)",
        transition: "transform 150ms ease, box-shadow 150ms ease",
        zIndex: 2,
        textAlign: "left",
        width: "calc(100% - 4px)",
        border: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 500,
          color: "var(--color-ink)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}
      >
        {event.title}
      </div>
      <div
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--color-ink-soft)",
          lineHeight: 1.2,
        }}
      >
        {formatTimeRange(event.start, event.end)}
      </div>
    </button>
  );
}
