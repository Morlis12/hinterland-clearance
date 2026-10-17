import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { dashboardKpis, latestSnapshotId, topComs, listSnapshots, filterOptions, type AggFilters } from "@/src/lib/stats";

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
  let importId = Number(url.searchParams.get("snapshot") ?? NaN);
  if (!Number.isFinite(importId)) {
    const latest = await latestSnapshotId(pool, "A");
    if (!latest) return NextResponse.json({ error: "Aucun snapshot importé." }, { status: 404 });
    importId = latest;
  }
  const f = readFilters(url);
  const kpis = await dashboardKpis(pool, importId, f);
  const top = await topComs(pool, importId, Number(url.searchParams.get("limit") ?? 15), f);
  const snapshots = await listSnapshots(pool, "A");
  const options = await filterOptions(pool, importId);
  // N-1 = snapshot A immédiatement précédent celui sélectionné (état global de la base)
  let evolution: { previous: Awaited<ReturnType<typeof dashboardKpis>>; recent: Awaited<ReturnType<typeof dashboardKpis>> } | null = null;
  const idx = snapshots.findIndex((s: { id: number }) => s.id === importId);
  const prevSnap = idx >= 0 && idx + 1 < snapshots.length ? snapshots[idx + 1] : null;
  if (prevSnap) {
    const kpP = await dashboardKpis(pool, prevSnap.id, f);
    evolution = { previous: kpP, recent: kpis };
  }
  return NextResponse.json({ importId, kpis, top, snapshots, evolution, options });
}
