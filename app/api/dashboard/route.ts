import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { dashboardKpis, latestSnapshotId, topComs, listSnapshots } from "@/src/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pool = getPool();
  let importId = Number(url.searchParams.get("snapshot") ?? NaN);
  if (!Number.isFinite(importId)) {
    const latest = await latestSnapshotId(pool, "A");
    if (!latest) return NextResponse.json({ error: "Aucun snapshot importé." }, { status: 404 });
    importId = latest;
  }
  const kpis = await dashboardKpis(pool, importId);
  const top = await topComs(pool, importId, Number(url.searchParams.get("limit") ?? 15));
  const snapshots = await listSnapshots(pool, "A");
  // N-1 = snapshot A immédiatement précédent celui sélectionné (état global de la base)
  let evolution: { previous: Awaited<ReturnType<typeof dashboardKpis>>; recent: Awaited<ReturnType<typeof dashboardKpis>> } | null = null;
  const idx = snapshots.findIndex((s: { id: number }) => s.id === importId);
  const prevSnap = idx >= 0 && idx + 1 < snapshots.length ? snapshots[idx + 1] : null;
  if (prevSnap) {
    const kpP = await dashboardKpis(pool, prevSnap.id);
    evolution = { previous: kpP, recent: kpis };
  }
  return NextResponse.json({ importId, kpis, top, snapshots, evolution });
}
