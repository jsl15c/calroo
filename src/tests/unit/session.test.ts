import { describe, expect, it } from "vitest";
import type { SessionPayload } from "@/lib/types";
import {
  buildSessionCookie,
  clearSessionCookie,
  decryptSession,
  encryptSession,
} from "@/server/auth/session";

const SECRET = "test-secret-32-bytes-long-padded!";

const PAYLOAD: SessionPayload = {
  accessToken: "access_token_value",
  refreshToken: "refresh_token_value",
  expiresAt: Date.now() + 3600_000,
  email: "test@example.com",
  name: "Test User",
  avatarUrl: null,
};

describe("session encryption", () => {
  it("encrypts and decrypts a session payload", async () => {
    const encrypted = await encryptSession(PAYLOAD, SECRET);
    expect(typeof encrypted).toBe("string");
    expect(encrypted).toContain(":");

    const decrypted = await decryptSession(encrypted, SECRET);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.email).toBe(PAYLOAD.email);
    expect(decrypted?.name).toBe(PAYLOAD.name);
    expect(decrypted?.accessToken).toBe(PAYLOAD.accessToken);
  });

  it("returns null when decrypting with wrong secret", async () => {
    const encrypted = await encryptSession(PAYLOAD, SECRET);
    const decrypted = await decryptSession(
      encrypted,
      "wrong-secret-32-bytes-padded!!",
    );
    expect(decrypted).toBeNull();
  });

  it("returns null for malformed encrypted string", async () => {
    const decrypted = await decryptSession("not-valid-data", SECRET);
    expect(decrypted).toBeNull();
  });

  it("returns null for empty string", async () => {
    const decrypted = await decryptSession("", SECRET);
    expect(decrypted).toBeNull();
  });

  it("produces a different ciphertext each call (random IV)", async () => {
    const enc1 = await encryptSession(PAYLOAD, SECRET);
    const enc2 = await encryptSession(PAYLOAD, SECRET);
    expect(enc1).not.toBe(enc2);
  });
});

describe("buildSessionCookie", () => {
  it("includes HttpOnly and SameSite=Lax", async () => {
    const cookie = await buildSessionCookie(PAYLOAD, SECRET);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("calroo_session=");
  });
});

describe("clearSessionCookie", () => {
  it("sets Max-Age=0", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("calroo_session=");
  });
});
