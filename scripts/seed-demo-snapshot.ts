import { getPool } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { CATEGORIES } from "../src/lib/import/constants";
import { CAT_COLUMNS } from "../src/lib/stats";
import { assertLocalDatabase, DEMO_EXTRACTION_DATE, DEMO_FILE_NAME } from "./demo-shared";

/**
 * Ajoute un snapshot A FICTIF antérieur (2026-09-23) pour la démonstration de l'évolution.
 * - Copie le dernier snapshot réel, retire ~0,7 % des dossiers et fait varier chaque
 *   catégorie de ±0,8 à 2 % (aléatoire, moitié en hausse moitié en baisse) : valeurs
 *   légèrement différentes, non déterministes.
 * - Marqué origin='demo' (« DÉMO » dans l'historique).
 * - LOCAL UNIQUEMENT : refuse de tourner si DATABASE_URL ne pointe pas vers une base locale.
 * - Jamais exécuté automatiquement.
 */
const P_DOWN = 0.03; // 3 % des dossiers « en retard » repassent à 0 (avant compensation)
const ROW_DROP = 0.007; // ~0,7 % des lignes retirées

async function main() {
  assertLocalDatabase();
  const pool = getPool();

  const existing = await pool.query(`SELECT id FROM imports WHERE origin='demo'`);
  if (existing.rows.length > 0) {
    logger.info("snapshot DÉMO déjà présent — rien à faire", { importId: existing.rows[0].id });
    await pool.end();
    return;
  }

  const latest = await pool.query(
    `SELECT id FROM imports WHERE file_type='A' AND origin <> 'demo' AND status IN ('success','warnings')
     ORDER BY extraction_date DESC, id DESC LIMIT 1`
  );
  if (latest.rows.length === 0) {
    console.error("Aucun snapshot réel à copier : importez d'abord un fichier A (npm run import).");
    await pool.end();
    process.exit(1);
  }
  const baseId = latest.rows[0].id as number;

  const counts = await pool.query(
    `SELECT ${CATEGORIES.map((c) => `COALESCE(SUM(${CAT_COLUMNS[c.key]}),0)::int AS "${c.key}"`).join(", ")}
     FROM raw_dossier_details WHERE import_id=$1`,
    [baseId]
  );
  const totalRows = (await pool.query(`SELECT COUNT(*)::int AS c FROM raw_dossier_details WHERE import_id=$1`, [baseId]))
    .rows[0].c as number;

  // Objectif par catégorie : cible = count * (1 + delta), delta aléatoire ±[0,8 %, 2 %],
  // moitié des catégories en hausse, moitié en baisse (flèches rouges ET vertes à la démo).
  const keys = CATEGORIES.map((c) => c.key);
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  const pUps = CATEGORIES.map((c, i) => {
    const count = Number(counts.rows[0][c.key] ?? 0);
    const sign = shuffled.indexOf(c.key) < keys.length / 2 ? 1 : -1;
    const delta = sign * (0.008 + Math.random() * 0.012);
    const denom = totalRows - count;
    if (count <= 0 || denom <= 0) return 0;
    return Math.max(0, (count * (P_DOWN + delta)) / denom);
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ins = await client.query(
      `INSERT INTO imports(file_name, sha256, file_type, extraction_date, row_count, status, warnings, origin)
       VALUES($1,$2,'A',$3::date,0,'warnings',$4,'demo') RETURNING id`,
      [
        DEMO_FILE_NAME,
        `demo-${Date.now()}`,
        DEMO_EXTRACTION_DATE,
        JSON.stringify(["Snapshot FICTIF de démonstration (DÉMO) — généré aléatoirement, usage local uniquement."]),
      ]
    );
    const demoId = ins.rows[0].id as number;

    await client.query(
      `INSERT INTO raw_com_summary(import_id, agency_id, com_unit_id, com_id, agency_name, com_unit_name, com_name,
         is_subtotal, dossiers_valides, bae, fact_douane, mise_en_livraison, livraison, retour_conteneur,
         declares_non_factures, fact_prestation, archivage, sans_declaration, debours)
       SELECT $1, agency_id, com_unit_id, com_id, agency_name, com_unit_name, com_name,
         is_subtotal, dossiers_valides, bae, fact_douane, mise_en_livraison, livraison, retour_conteneur,
         declares_non_factures, fact_prestation, archivage, sans_declaration, debours
       FROM raw_com_summary WHERE import_id=$2`,
      [demoId, baseId]
    );

    // Probabilités passées en paramètres ($3..$12), une par catégorie.
    const newExpr = CATEGORIES.map(
      (c, i) =>
        `(CASE WHEN ${CAT_COLUMNS[c.key]}=1 THEN (CASE WHEN random()<${P_DOWN} THEN 0 ELSE 1 END) ` +
        `ELSE (CASE WHEN random()<$${3 + i} THEN 1 ELSE 0 END) END)::int AS ${c.key}_new`
    ).join(",\n         ");
    const maskExpr = CATEGORIES.map((c, i) => {
      const col = `${c.key}_new`;
      const bit = 1 << i;
      return bit === 1 ? col : `${bit}*${col}`;
    }).join(" + ");

    await client.query(
      `INSERT INTO raw_dossier_details(import_id, agency_id, com_unit_id, com_id, agency_name, com_unit_name, com_name,
         dossier, bae, fact_douane, mise_en_livraison, livraison, retour_conteneur, declares_non_factures,
         fact_prestation, archivage, sans_declaration, debours, flags_mask)
       SELECT $1, agency_id, com_unit_id, com_id, agency_name, com_unit_name, com_name, dossier,
         ${CATEGORIES.map((c) => `${c.key}_new`).join(", ")}, ${maskExpr}
       FROM (
         SELECT agency_id, com_unit_id, com_id, agency_name, com_unit_name, com_name, dossier,
         ${newExpr}
         FROM raw_dossier_details
         WHERE import_id=$2 AND random() >= ${ROW_DROP}
       ) t`,
      [demoId, baseId, ...pUps]
    );

    await client.query(
      `UPDATE imports SET row_count=(SELECT COUNT(*) FROM raw_dossier_details WHERE import_id=$1) WHERE id=$1`,
      [demoId]
    );
    await client.query("COMMIT");

    const after = await client.query(
      `SELECT COUNT(*)::int AS rows, ${CATEGORIES.map((c) => `COALESCE(SUM(${CAT_COLUMNS[c.key]}),0)::int AS "${c.key}"`).join(", ")}
       FROM raw_dossier_details WHERE import_id=$1`,
      [demoId]
    );
    const a = after.rows[0];
    logger.info("snapshot DÉMO créé", {
      importId: demoId,
      extractionDate: DEMO_EXTRACTION_DATE,
      rows: a.rows,
      variations: CATEGORIES.map((c) => ({
        cat: c.key,
        base: Number(counts.rows[0][c.key] ?? 0),
        demo: Number(a[c.key] ?? 0),
      })),
      copiedFrom: baseId,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Échec seed DÉMO :", String((e as Error)?.message ?? e));
  process.exit(1);
});
