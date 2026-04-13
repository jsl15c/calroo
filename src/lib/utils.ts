// Date helpers and formatters used across the app.

/** Returns the Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Adds `days` to a date, returns a new Date. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Formats a Date as "Mon, Apr 13". */
export function formatDayHeader(date: Date): { weekday: string; date: string } {
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

/** Formats a time string like "2:30 PM" from an ISO date string. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Formats a time range like "2:00 – 2:30 PM". */
export function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startStr = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endStr = endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${startStr} – ${endStr}`;
}

/** Formats a full date like "Thursday, April 16". */
export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Returns true if two ISO date strings fall on the same calendar day. */
export function isSameDay(a: string | Date, b: string | Date): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

/** Calculates event top position and height as percentages of a time column
 *  spanning from `columnStart` to `columnEnd` hours (e.g. 7 to 21).
 */
export function eventPositionStyle(
  eventStart: string,
  eventEnd: string,
  columnStartHour: number,
  columnEndHour: number,
): { top: string; height: string } {
  const start = new Date(eventStart);
  const end = new Date(eventEnd);
  const totalMinutes = (columnEndHour - columnStartHour) * 60;
  const startMinutes =
    (start.getHours() - columnStartHour) * 60 + start.getMinutes();
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;

  const top = Math.max(0, (startMinutes / totalMinutes) * 100);
  const height = Math.max(2, (durationMinutes / totalMinutes) * 100);

  return {
    top: `${top}%`,
    height: `${height}%`,
  };
}

/** Generates a short unique id (not cryptographically secure — UI use only). */
export function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Time-aware greeting for the landing page. */
export function getGreeting(): string {
  const hour = new Date().getHours();
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6)
    return "A fine weekend ahead. Anything to arrange?";
  if (hour < 12) return "Good morning. Shall we review your week?";
  if (hour < 17) return "Good afternoon. Your schedule awaits.";
  return "Good evening. Let's prepare for tomorrow.";
}
