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
  // mini-évolution : deux dernières extractions
  let evolution: unknown = null;
  if (snapshots.length >= 2) {
    const [n, prev] = [snapshots[0].id, snapshots[1].id];
    const kpN = await dashboardKpis(pool, n);
    const kpP = await dashboardKpis(pool, prev);
    evolution = { recent: kpN, previous: kpP };
  }
  return NextResponse.json({ importId, kpis, top, snapshots, evolution });
}
