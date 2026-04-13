// Auth guard for protected API routes.
// Every protected route must call getSession() and check for null.

import { env } from "@/lib/env";
import type { SessionPayload } from "@/lib/types";
import { refreshAccessToken } from "./google-oauth";
import { buildSessionCookie, getSession } from "./session";

export type SessionResult = {
  session: SessionPayload;
  updatedCookie: string | null;
} | null;

/**
 * Reads the session cookie, decrypts it, and refreshes the access token
 * if it's expired. Returns null if there is no valid session.
 *
 * If the token was refreshed, `updatedCookie` is set — the caller must
 * attach it to the response so the client gets the updated cookie.
 */
export async function requireSession(request: Request): Promise<SessionResult> {
  const session = await getSession(request, env.SESSION_SECRET);
  if (!session) return null;

  const now = Date.now();
  const isExpired = session.expiresAt < now + 60_000; // refresh 1 min early

  if (!isExpired) {
    return { session, updatedCookie: null };
  }

  try {
    const refreshed = await refreshAccessToken(
      session.refreshToken,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
    );

    const updatedSession: SessionPayload = {
      ...session,
      accessToken: refreshed.access_token,
      expiresAt: now + refreshed.expires_in * 1000,
    };

    const updatedCookie = await buildSessionCookie(
      updatedSession,
      env.SESSION_SECRET,
    );

    return { session: updatedSession, updatedCookie };
  } catch {
    // Refresh failed — user must re-authenticate
    return null;
  }
}
