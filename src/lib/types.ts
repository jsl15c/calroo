// ─── Canonical domain types ───────────────────────────────
// All code uses these — never raw Google API shapes.

export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  attendees: string[]; // email addresses
  recurring: boolean;
  status: "confirmed" | "tentative" | "cancelled";
  description?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  confirmationCard?: ConfirmationCard; // present when Scheduler proposes a write
};

export type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type ConfirmationCard = {
  action: "create" | "update" | "delete";
  event: {
    title: string;
    start: string;
    end: string;
    attendees: string[];
    description?: string;
  };
  existingEventId?: string; // for update/delete
};

// ─── Auth state ──────────────────────────────────────────
export type AuthState =
  | { status: "authenticated"; session: SessionPayload }
  | { status: "unauthenticated" };
