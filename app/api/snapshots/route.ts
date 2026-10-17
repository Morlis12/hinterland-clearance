import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { listSnapshots, latestSnapshotId } from "@/src/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const pool = getPool();
  const snapshots = await listSnapshots(pool);
  const latest = await latestSnapshotId(pool);
  return NextResponse.json({ snapshots, latest });
}
