import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { parseMulti } from "@/src/lib/filters";
import { trendsAll, type AggFilters } from "@/src/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const f: AggFilters = {
    agence: parseMulti(url.searchParams, "agence"),
    unite: parseMulti(url.searchParams, "unite"),
    com: parseMulti(url.searchParams, "com"),
    categorie: parseMulti(url.searchParams, "categorie"),
    q: url.searchParams.get("q") ?? undefined,
  };
  const rows = await trendsAll(getPool(), f);
  return NextResponse.json({ snapshots: rows });
}
