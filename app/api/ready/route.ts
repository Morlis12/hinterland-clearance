import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    const r = await pool.query("SELECT COUNT(*)::int AS c FROM imports");
    return NextResponse.json({ status: "ready", db: "ok", imports: r.rows[0].c });
  } catch (e) {
    logger.error("readiness échec", { error: String(e) });
    return NextResponse.json({ status: "not-ready", db: String(e) }, { status: 503 });
  }
}
