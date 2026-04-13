// POST /api/auth/logout — clears session cookie.

import { env } from "@/lib/env";
import { clearSessionCookie } from "@/server/auth/session";

export async function POST(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie(),
      Location: env.NEXT_PUBLIC_APP_URL,
    },
  });
}
