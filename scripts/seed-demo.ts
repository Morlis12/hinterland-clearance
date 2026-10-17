#!/usr/bin/env tsx
/** Jeu de données de démonstration FICTIF (faux COM) pour tester sans données réelles. */
import { getPool } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { ensureAgency, ensureCom, ensureUnit, newRefCache, batchInsertDetails, batchInsertSummary } from "../src/lib/import/persist";
import { maskFromFlags } from "../src/lib/import/constants";

const AGENCIES = ["Abidjan-Démo", "San-Pedro-Démo"];
const UNITS = ["CM01", "CM02", "CM03"];
const COMS = ["Kouassi Démo", "Diarra Démo", "N'Guessan Démo", "Touré Démo", "Koné Démo", "Bakayoko Démo"];

function rnd(n: number) { return Math.floor(Math.random() * n); }

async function main() {
  const pool = getPool();
  const extractionDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const ins = await pool.query(
    `INSERT INTO imports(file_name, sha256, file_type, extraction_date, row_count, status, warnings, origin) VALUES('demo-fictif.xlsx','demo-' || md5(random()::text),'A',$1::date,0,'success','["Jeu de démonstration fictif"]','cli') RETURNING id`,
    [extractionDate]
  );
  const importId = ins.rows[0].id as number;
  const cache = newRefCache();

  const summary: Parameters<typeof batchInsertSummary>[2] = [];
  for (const ag of AGENCIES) {
    const agId = await ensureAgency(pool, cache, ag);
    for (const u of UNITS) {
      const uId = await ensureUnit(pool, cache, agId, u);
      for (const c of COMS) {
        if (Math.random() < 0.3) continue;
        const cId = await ensureCom(pool, cache, agId, uId, `${c} (${u})`);
        const flags = {
          bae: rnd(4) === 0 ? 1 : 0, factDouane: 0, miseEnLivraison: 0,
          livraison: rnd(6) === 0 ? 1 : 0, retourConteneur: 0,
          declaresNonFactures: rnd(8) === 0 ? 2 : rnd(3),
          factPrestation: rnd(5), archivage: 5 + rnd(40),
          sansDeclaration: rnd(6), debours: 4 + rnd(30),
        };
        summary.push({
          agencyId: agId, unitId: uId, comId: cId,
          agencyName: ag, unitName: u, comName: `${c} (${u})`,
          isSubtotal: false, dossiersValides: 200 + rnd(1500), flags,
        });
      }
    }
  }
  await batchInsertSummary(pool, importId, summary);

  const details: Parameters<typeof batchInsertDetails>[3] = [];
  let n = 0;
  for (let i = 0; i < 600; i++) {
    const ag = AGENCIES[rnd(AGENCIES.length)];
    const agId = await ensureAgency(pool, cache, ag);
    const u = UNITS[rnd(UNITS.length)];
    const uId = await ensureUnit(pool, cache, agId, u);
    const c = `${COMS[rnd(COMS.length)]} (${u})`;
    const cId = await ensureCom(pool, cache, agId, uId, c);
    const flags = {
      bae: rnd(30) === 0 ? 1 : 0, factDouane: 0, miseEnLivraison: 0,
      livraison: rnd(40) === 0 ? 1 : 0, retourConteneur: 0,
      declaresNonFactures: rnd(25) === 0 ? 1 : 0,
      factPrestation: rnd(12) === 0 ? 1 : 0, archivage: rnd(3) === 0 ? 1 : 0,
      sansDeclaration: rnd(10) === 0 ? 1 : 0, debours: rnd(3) === 0 ? 1 : 0,
    };
    if (Object.values(flags).every((v) => v === 0)) flags.archivage = 1;
    details.push({
      agencyId: agId, unitId: uId, comId: cId,
      agencyName: ag, unitName: u, comName: c,
      dossier: `DEMO${String(25000000 + n++).slice(1)}`,
      flags, mask: maskFromFlags(flags),
    });
  }
  await batchInsertDetails(pool, "raw_dossier_details", importId, details);
  await pool.query(`UPDATE imports SET row_count=$1 WHERE id=$2`, [details.length, importId]);
  logger.info("seed démo terminé", { importId, dossiers: details.length, coms: summary.length });
  await pool.end();
}

main().catch((e) => { logger.error("seed échec", { error: String(e) }); process.exit(1); });
