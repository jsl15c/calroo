// GET /api/auth/callback — handles Google OAuth callback, sets session cookie.

import { env } from "@/lib/env";
import type { SessionPayload } from "@/lib/types";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
} from "@/server/auth/google-oauth";
import { buildSessionCookie } from "@/server/auth/session";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appUrl = env.NEXT_PUBLIC_APP_URL;

  if (error || !code) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/?error=auth_failed` },
    });
  }

  // Verify OAuth state to prevent CSRF
  const cookieHeader = request.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("oauth_state="))
    ?.slice("oauth_state=".length);

  if (!state || state !== stateCookie) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/?error=state_mismatch` },
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI,
    );

    const userInfo = await fetchUserInfo(tokens.access_token);

    const session: SessionPayload = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.picture ?? null,
    };

    const sessionCookie = await buildSessionCookie(session, env.SESSION_SECRET);

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appUrl}/dashboard`,
        "Set-Cookie": [
          sessionCookie,
          "oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", // clear state cookie
        ].join(", "),
      },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/?error=token_exchange_failed` },
    });
  }
}
