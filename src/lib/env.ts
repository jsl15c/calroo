// Env validation — fails fast at startup if required vars are missing.
// Never fall back to defaults for secrets.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[CalRoo] Missing required environment variable: ${name}\n` +
        "Check .env.local (dev) or your Cloudflare Pages dashboard (prod).",
    );
  }
  return value;
}

export const env = {
  // Google OAuth
  GOOGLE_CLIENT_ID: requireEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: requireEnv("GOOGLE_CLIENT_SECRET"),
  GOOGLE_REDIRECT_URI: requireEnv("GOOGLE_REDIRECT_URI"),

  // Session encryption (32+ byte random string)
  SESSION_SECRET: requireEnv("SESSION_SECRET"),

  // AI
  ANTHROPIC_API_KEY: requireEnv("ANTHROPIC_API_KEY"),

  // App
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
