import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionValue } from "@/src/lib/auth";
import { getPool } from "@/src/lib/db";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

// Sonde publique : sans session valide, la réponse se limite à « ok » / « non prêt ».
// Le nombre d'imports et le détail de l'erreur ne sont donnés qu'avec une session.
async function isAuthenticated(req: NextRequest): Promise<boolean> {
  try {
    return Boolean(await verifySessionValue(req.cookies.get(COOKIE_NAME)?.value));
  } catch {
    // Config de session absente : on reste en mode public plutôt que de répondre 500.
    return false;
  }
}

export async function GET(req: NextRequest) {
  const authenticated = await isAuthenticated(req);
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    // Vérifie aussi que le schéma est migré (table imports présente).
    const r = await pool.query("SELECT COUNT(*)::int AS c FROM imports");
    return NextResponse.json(
      authenticated ? { status: "ok", db: "ok", imports: r.rows[0].c } : { status: "ok" }
    );
  } catch (e) {
    logger.error("readiness échec", { error: String(e) });
    return NextResponse.json(
      authenticated ? { status: "non prêt", db: String(e) } : { status: "non prêt" },
      { status: 503 }
    );
  }
}
