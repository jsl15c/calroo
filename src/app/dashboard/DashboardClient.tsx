"use client";

import { PanelRightOpen } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Header } from "@/components/layout/Header";
import type { CalendarEvent, SessionPayload } from "@/lib/types";
import { addDays, formatDayHeader, startOfWeek } from "@/lib/utils";

type DashboardClientProps = {
  session: SessionPayload;
};

export function DashboardClient({ session }: DashboardClientProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const fetchEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const response = await fetch("/api/calendar/events");
      if (response.ok) {
        const data = (await response.json()) as { events: CalendarEvent[] };
        setEvents(data.events);
      }
    } catch {
      // silently fail — events just won't populate
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const currentWeekLabel = (() => {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    const end = addDays(base, 6);
    const { date: startDate } = formatDayHeader(base);
    const { date: endDate } = formatDayHeader(end);
    return `${startDate} – ${endDate}`;
  })();

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "var(--color-parchment)",
        overflow: "hidden",
      }}
    >
      <Header
        session={session}
        weekOffset={weekOffset}
        onPrevWeek={() => setWeekOffset((w) => w - 1)}
        onNextWeek={() => setWeekOffset((w) => w + 1)}
        onToday={() => setWeekOffset(0)}
        currentWeekLabel={currentWeekLabel}
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: chatCollapsed ? "1fr" : "1fr 420px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Calendar grid */}
        <div style={{ overflow: "hidden", position: "relative" }}>
          {isLoadingEvents ? (
            <CalendarSkeleton />
          ) : (
            <CalendarGrid events={events} weekOffset={weekOffset} />
          )}
        </div>

        {/* Chat panel */}
        {!chatCollapsed && (
          <ChatPanel
            events={events}
            timezone={timezone}
            onCalendarRefresh={fetchEvents}
            isCollapsed={false}
            onToggleCollapse={() => setChatCollapsed(true)}
          />
        )}

        {/* Re-open chat FAB when collapsed */}
        {chatCollapsed && (
          <button
            type="button"
            onClick={() => setChatCollapsed(false)}
            aria-label="Open chat"
            title="Chat with Roo"
            style={{
              position: "fixed",
              bottom: "var(--space-6)",
              right: "var(--space-6)",
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-mahogany)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              boxShadow: "var(--shadow-lg)",
              zIndex: 20,
            }}
          >
            <PanelRightOpen size={20} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "var(--space-3)",
        color: "var(--color-ink-faint)",
        fontStyle: "italic",
        fontSize: "var(--text-sm)",
      }}
    >
      <Image src="/roo/roo-avatar.svg" alt="" width={32} height={32} />
      Consulting your schedule...
    </div>
  );
}
