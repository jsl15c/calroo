// GET /api/auth/google — initiates Google OAuth flow.

import { env } from "@/lib/env";
import { buildAuthUrl } from "@/server/auth/google-oauth";

export async function GET(): Promise<Response> {
  // Generate a random state value to prevent CSRF
  const state = crypto.randomUUID();

  const authUrl = buildAuthUrl(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_REDIRECT_URI,
    state,
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      // Store state in a short-lived cookie for verification in the callback
      "Set-Cookie": `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
