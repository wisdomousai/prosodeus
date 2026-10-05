import type { Context, Next } from "hono";
import type { Env } from "./index.ts";

/**
 * JWT authentication middleware.
 * - Production: verifies JWT from Authorization header using JWKS
 * - Dev mode (PROSODEUS_DEV=true): assigns a fixed local user ID
 */
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Dev mode bypass
  if (c.env.PROSODEUS_DEV === "true" || (!c.env.WORKOS_CLIENT_ID && !c.env.JWKS_URL)) {
    c.set("userId" as never, "dev-user");
    c.set("email" as never, "dev@localhost");
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyJWT(token, c.env);
    c.set("userId" as never, payload.sub);
    c.set("email" as never, payload.email ?? "");
    return next();
  } catch (err) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

// ─── JWT Verification ────────────────────────────────────────────────────────

interface JWTPayload {
  sub: string;
  email?: string;
  exp: number;
  iat: number;
}

interface JWK {
  kty: string;
  kid: string;
  use: string;
  n: string;
  e: string;
  alg: string;
}

let cachedKeys: Map<string, CryptoKey> | null = null;
let keysExpiry = 0;

async function verifyJWT(token: string, env: Env): Promise<JWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))) as JWTPayload;

  // Check expiration
  if (payload.exp && payload.exp < Date.now() / 1000) {
    throw new Error("Token expired");
  }

  // Get signing key
  const key = await getSigningKey(header.kid, env);
  if (!key) throw new Error("Unknown signing key");

  // Verify signature
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToArrayBuffer(signatureB64);

  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    key,
    signature,
    data,
  );

  if (!valid) throw new Error("Invalid signature");

  return payload;
}

async function getSigningKey(kid: string, env: Env): Promise<CryptoKey | null> {
  // Cache JWKS for 1 hour
  if (cachedKeys && Date.now() < keysExpiry) {
    return cachedKeys.get(kid) ?? null;
  }

  const jwksUrl = env.JWKS_URL ?? `https://api.workos.com/sso/jwks/${env.WORKOS_CLIENT_ID}`;
  const response = await fetch(jwksUrl);
  if (!response.ok) throw new Error("Failed to fetch JWKS");

  const { keys } = (await response.json()) as { keys: JWK[] };

  cachedKeys = new Map();
  for (const jwk of keys) {
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    cachedKeys.set(jwk.kid, cryptoKey);
  }

  keysExpiry = Date.now() + 3600_000; // 1 hour
  return cachedKeys.get(kid) ?? null;
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
