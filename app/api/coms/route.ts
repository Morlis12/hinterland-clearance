import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { comMatrix, latestSnapshotId } from "@/src/lib/stats";

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
  const rows = await comMatrix(pool, importId);
  const agences = [...new Set(rows.map((r) => r.agence).filter(Boolean))].sort();
  const unites = [...new Set(rows.map((r) => r.uniteCom).filter(Boolean))].sort();
  return NextResponse.json({ importId, rows, agences, unites });
}
