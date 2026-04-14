"use client";

import { PanelRightOpen } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Header } from "@/components/layout/Header";
import type { CalendarEvent, SessionPayload } from "@/lib/types";
import {
  addDays,
  endOfMonth,
  formatDayHeader,
  formatMonthYear,
  startOfMonth,
  startOfWeek,
} from "@/lib/utils";

type DashboardClientProps = {
  session: SessionPayload;
};

export function DashboardClient({ session }: DashboardClientProps) {
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
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

  // Compute the visible date range and label for both modes
  const { currentLabel, offset, viewRange } = useMemo(() => {
    const today = new Date();

    if (viewMode === "week") {
      const base = startOfWeek(today);
      base.setDate(base.getDate() + weekOffset * 7);
      const end = addDays(base, 6);
      const { date: startDate } = formatDayHeader(base);
      const { date: endDate } = formatDayHeader(end);
      return {
        currentLabel: `${startDate} – ${endDate}`,
        offset: weekOffset,
        viewRange: {
          start: base.toISOString(),
          end: end.toISOString(),
          mode: "week" as const,
        },
      };
    }

    // month mode
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const start = startOfMonth(base);
    const end = endOfMonth(base);
    return {
      currentLabel: formatMonthYear(base),
      offset: monthOffset,
      viewRange: {
        start: start.toISOString(),
        end: end.toISOString(),
        mode: "month" as const,
      },
    };
  }, [viewMode, weekOffset, monthOffset]);

  const handleViewModeChange = (mode: "week" | "month") => {
    setViewMode(mode);
    // Reset offsets when switching modes so we land on "today"
    setWeekOffset(0);
    setMonthOffset(0);
  };

  const handlePrev = () => {
    if (viewMode === "week") setWeekOffset((w) => w - 1);
    else setMonthOffset((m) => m - 1);
  };

  const handleNext = () => {
    if (viewMode === "week") setWeekOffset((w) => w + 1);
    else setMonthOffset((m) => m + 1);
  };

  const handleToday = () => {
    setWeekOffset(0);
    setMonthOffset(0);
  };

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
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        offset={offset}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        currentLabel={currentLabel}
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
          ) : viewMode === "week" ? (
            <CalendarGrid events={events} weekOffset={weekOffset} />
          ) : (
            <CalendarMonthGrid events={events} monthOffset={monthOffset} />
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
            viewContext={viewRange}
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
