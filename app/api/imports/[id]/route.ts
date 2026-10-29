import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { deleteImport } from "@/src/lib/import/persist";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

// Suppression d'un import chargé par erreur (bouton "Supprimer" de l'historique) :
// retire ses lignes de la base immédiatement (raw_*), jamais les référentiels partagés.
// L'authentification est déjà exigée pour toute route /api/* par middleware.ts.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const importId = Number(params.id);
  if (!Number.isInteger(importId) || importId <= 0) {
    return NextResponse.json({ error: "Identifiant d'import invalide." }, { status: 400 });
  }
  try {
    const pool = getPool();
    const deleted = await deleteImport(pool, importId);
    if (!deleted) {
      return NextResponse.json({ error: "Import introuvable (déjà supprimé ?)." }, { status: 404 });
    }
    logger.info("import supprimé", { importId, fileName: deleted.fileName, rowCount: deleted.rowCount });
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    logger.error("échec de la suppression d'import", { importId, error: String(e) });
    return NextResponse.json({ error: "Échec de la suppression." }, { status: 500 });
  }
}
