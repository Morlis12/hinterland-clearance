import { config } from "./env";

/**
 * Identité utilisateur — module unique à remplacer plus tard par Microsoft Entra ID.
 * Aujourd'hui : mot de passe partagé + cookie de session signé (HMAC-SHA256).
 * Compatible Edge runtime (Web Crypto uniquement, aucun import node:).
 */

export interface UserIdentity {
  kind: "shared-password";
  authenticatedAt: string;
}

const COOKIE_NAME = "hinterland_session";
const enc = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionValue(): Promise<string> {
  const payload = `auth:${Date.now()}`;
  const sig = await hmacHex(payload, config.sessionSecret);
  return `${payload}.${sig}`;
}

export async function verifySessionValue(cookieValue: string | undefined): Promise<UserIdentity | null> {
  if (!cookieValue) return null;
  const idx = cookieValue.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);
  if (!payload.startsWith("auth:")) return null;
  const expected = await hmacHex(payload, config.sessionSecret);
  if (!safeEqual(sig, expected)) return null;
  return { kind: "shared-password", authenticatedAt: payload.slice(5) };
}

export function verifyPassword(candidate: string): boolean {
  const expected = config.appPassword;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

export function isAuthConfigured(): boolean {
  return Boolean(config.appPassword);
}

export { COOKIE_NAME };
