import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { parseMulti } from "@/src/lib/filters";
import { config } from "@/src/lib/env";
import { queryDossiers, latestSnapshotId } from "@/src/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pool = getPool();
  let importId = Number(url.searchParams.get("snapshot") ?? NaN);
  if (!Number.isFinite(importId)) {
    const latest = await latestSnapshotId(pool, "A");
    if (!latest) return NextResponse.json({ error: "Aucun snapshot." }, { status: 404 });
    importId = latest;
  }
  const max = config.exportMaxRows;
  const data = await queryDossiers(pool, importId, {
    q: url.searchParams.get("q") ?? undefined,
    agence: parseMulti(url.searchParams, "agence"),
    unite: parseMulti(url.searchParams, "unite"),
    com: parseMulti(url.searchParams, "com"),
    categorie: parseMulti(url.searchParams, "categorie"),
    page: 1, pageSize: max, maxPageSize: max, sort: "dossier", dir: "asc",
  });
  if (data.total > max) {
    return NextResponse.json(
      { error: `Export limité à ${max.toLocaleString("fr-FR")} lignes ; votre filtre retourne ${data.total.toLocaleString("fr-FR")} lignes. Affinez les filtres.` },
      { status: 413 }
    );
  }
  const meta = (await pool.query(`SELECT extraction_date, loaded_at FROM imports WHERE id=$1`, [importId])).rows[0];
  const dExtr = meta ? String(new Date(meta.extraction_date).toISOString().slice(0, 10)).split("-").reverse().join("/") : "";
  const dLoad = meta ? new Date(meta.loaded_at).toLocaleString("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const header = "date_extraction;date_chargement;dossier;agence;unite_com;com;bae;facturation_douane;mise_en_livraison;livraison;retour_conteneur;declares_non_factures;facturation_prestation;archivage;sans_declaration;avec_debours";
  const lines = data.rows.map((r: Record<string, unknown>) =>
    [dExtr, dLoad, r.dossier, r.agence, r.unite, r.com, r.bae, r.factDouane, r.miseEnLivraison, r.livraison, r.retourConteneur, r.declaresNonFactures, r.factPrestation, r.archivage, r.sansDeclaration, r.debours]
      .map((v) => String(v ?? "").replace(/;/g, ",")).join(";")
  );
  const csv = "\uFEFF" + header + "\n" + lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dossiers_snapshot_${importId}.csv"`,
    },
  });
}
