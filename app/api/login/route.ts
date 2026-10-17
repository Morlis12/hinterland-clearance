import { NextResponse } from "next/server";
import { createSessionValue, verifyPassword, COOKIE_NAME, isAuthConfigured } from "@/src/lib/auth";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = String((body as { password?: string }).password ?? "");
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "APP_PASSWORD non configuré côté serveur." }, { status: 500 });
  }
  if (!verifyPassword(password)) {
    logger.warn("échec authentification");
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  logger.info("authentification réussie");
  return res;
}
