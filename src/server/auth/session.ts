// Cookie encryption/decryption using Web Crypto API (AES-GCM).
// No Node.js crypto module — Cloudflare Workers compatible.

import type { SessionPayload } from "@/lib/types";

const COOKIE_NAME = "calroo_session";
const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // bytes

/** Derives a CryptoKey from the SESSION_SECRET env var. */
async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const rawKey = encoder.encode(secret.slice(0, 32).padEnd(32, "0"));
  return crypto.subtle.importKey("raw", rawKey, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypts a SessionPayload into a base64 string (iv:ciphertext). */
export async function encryptSession(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${ivB64}:${ctB64}`;
}

/** Decrypts a base64 session string back to SessionPayload. Returns null on failure. */
export async function decryptSession(
  encrypted: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const [ivB64, ctB64] = encrypted.split(":");
    if (!ivB64 || !ctB64) return null;

    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

    const key = await getKey(secret);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext,
    );

    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Reads and decrypts the session cookie from a Request. Returns null if missing or invalid. */
export async function getSession(
  request: Request,
  secret: string,
): Promise<SessionPayload | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;

  const value = match.slice(COOKIE_NAME.length + 1);
  return decryptSession(value, secret);
}

/** Builds a Set-Cookie header string for the session. */
export async function buildSessionCookie(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const encrypted = await encryptSession(payload, secret);
  return [
    `${COOKIE_NAME}=${encrypted}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Builds a Set-Cookie header that clears the session cookie. */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
