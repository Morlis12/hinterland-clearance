import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { evolutionCompare, listSnapshots, filterOptions, type AggFilters } from "@/src/lib/stats";

export const dynamic = "force-dynamic";

function readFilters(url: URL): AggFilters {
  return {
    agence: url.searchParams.get("agence") ?? undefined,
    unite: url.searchParams.get("unite") ?? undefined,
    com: url.searchParams.get("com") ?? undefined,
    categorie: url.searchParams.get("categorie") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pool = getPool();
  // L'évolution compare des snapshots du Fichier A (dossiers en retard).
  // Les imports du Fichier B (non archivés) restent visibles dans l'historique /import.
  const snapshots = await listSnapshots(pool, "A");
  if (snapshots.length === 0) return NextResponse.json({ error: "Aucun snapshot." }, { status: 404 });
  if (snapshots.length === 1) {
    return NextResponse.json({ snapshots, single: true, message: "Un seul snapshot disponible : importez une seconde extraction pour comparer." });
  }
  const recentId = Number(url.searchParams.get("n") ?? snapshots[0].id);
  const prevId = Number(url.searchParams.get("n1") ?? snapshots[1].id);
  const f = readFilters(url);
  const cmp = await evolutionCompare(pool, prevId, recentId, f);
  const options = await filterOptions(pool, recentId);
  const meta = {
    recentSnap: snapshots.find((s) => s.id === recentId),
    previousSnap: snapshots.find((s) => s.id === prevId),
  };
  return NextResponse.json({ snapshots, ...cmp, ...meta, options });
}
