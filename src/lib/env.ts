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

  // Cloudflare Workers AI — REST API credentials.
  // Used for local dev (`next dev`) where the Workers AI binding isn't available.
  // Get your Account ID from dash.cloudflare.com, and create an API token with
  // "Workers AI" permissions at dash.cloudflare.com/profile/api-tokens.
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? null,
  CLOUDFLARE_AI_API_TOKEN: process.env.CLOUDFLARE_AI_API_TOKEN ?? null,

  // Cloudflare AI Gateway URL (optional — routes CF REST API calls through the gateway for
  // observability and caching). Format: https://gateway.ai.cloudflare.com/v1/{account}/{gateway}
  CLOUDFLARE_AI_GATEWAY_URL: process.env.CLOUDFLARE_AI_GATEWAY_URL ?? null,

  // Anthropic API key — only needed if NOT using Cloudflare Workers AI at all.
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null,

  // App
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
