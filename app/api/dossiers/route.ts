import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
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
  const dir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
  const data = await queryDossiers(pool, importId, {
    q: url.searchParams.get("q") ?? undefined,
    agence: url.searchParams.get("agence") ?? undefined,
    unite: url.searchParams.get("unite") ?? undefined,
    com: url.searchParams.get("com") ?? undefined,
    categorie: url.searchParams.get("categorie") ?? undefined,
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 50),
    sort: url.searchParams.get("sort") ?? "dossier",
    dir,
  });
  return NextResponse.json({ importId, ...data });
}
