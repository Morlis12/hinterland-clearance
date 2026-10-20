import { getPool } from "../src/lib/db";
import { CATEGORIES } from "../src/lib/import/constants";
import { comMatrix, dashboardKpis, filterOptions, latestSnapshotId, type AggFilters } from "../src/lib/stats";

const KEYS = ["total", ...CATEGORIES.map((c) => c.key)] as const;

async function check(pool: ReturnType<typeof getPool>, importId: number, label: string, f: AggFilters) {
  const kpis = (await dashboardKpis(pool, importId, f)) as unknown as Record<string, number>;
  const rows = await comMatrix(pool, importId, f);
  const sums: Record<string, number> = Object.fromEntries(KEYS.map((k) => [k, 0]));
  for (const row of rows) {
    for (const key of KEYS) {
      sums[key] += Number((row as Record<string, unknown>)[key] ?? 0);
    }
  }
  const diffs = KEYS.filter((key) => sums[key] !== Number(kpis[key] ?? 0));
  const status = diffs.length === 0 ? "OK" : "ÉCART";
  console.log(`${status} ${label} — ${rows.length} ligne(s)`);
  for (const key of diffs) {
    console.log(`  ${key}: COM=${sums[key]} dashboard=${Number(kpis[key] ?? 0)} écart=${sums[key] - Number(kpis[key] ?? 0)}`);
  }
  return diffs.length === 0;
}

async function main() {
  const pool = getPool();
  try {
    const importId = Number(process.argv[2]) || (await latestSnapshotId(pool, "A"));
    if (!importId) throw new Error("Aucun snapshot A disponible.");
    console.log(`Audit matrice COM vs dashboard — snapshot ${importId}`);
    const options = await filterOptions(pool, importId);
    let ok = await check(pool, importId, "Toutes agences", {});
    for (const agence of options.agences) {
      ok = (await check(pool, importId, agence, { agence: [agence] })) && ok;
    }
    if (!ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Échec audit matrice COM :", String((e as Error)?.message ?? e));
  process.exit(1);
});
