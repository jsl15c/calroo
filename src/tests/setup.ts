// Vitest global setup — polyfills Web Crypto API for Node 18.
// The actual runtime (Cloudflare Workers / Node 19+) exposes crypto globally.
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  // @ts-expect-error — polyfilling global crypto for Node 18 test environment
  globalThis.crypto = webcrypto;
}
