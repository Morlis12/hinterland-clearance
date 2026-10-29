import { Pool } from "pg";
import { logger } from "../logger";

export interface RefCache {
  agencies: Map<string, number>;
  units: Map<string, number>; // `${agencyId}|${unitName}`
  coms: Map<string, number>; // `${agencyId}|${unitId}|${comName}`
}

export function newRefCache(): RefCache {
  return { agencies: new Map(), units: new Map(), coms: new Map() };
}

export async function ensureAgency(pool: Pool, cache: RefCache, name: string): Promise<number | null> {
  const clean = (name ?? "").trim();
  if (!clean) return null;
  const hit = cache.agencies.get(clean);
  if (hit) return hit;
  const r = await pool.query(
    `INSERT INTO agencies(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
    [clean]
  );
  const id = r.rows[0].id as number;
  cache.agencies.set(clean, id);
  return id;
}

export async function ensureUnit(
  pool: Pool, cache: RefCache, agencyId: number | null, unitName: string
): Promise<number | null> {
  const clean = (unitName ?? "").trim();
  if (!clean) return null;
  const key = `${agencyId ?? "null"}|${clean}`;
  const hit = cache.units.get(key);
  if (hit) return hit;
  // com_units a une contrainte unique (name, agency_id) — agency NULL géré à part
  if (agencyId === null) {
    const existing = await pool.query(`SELECT id FROM com_units WHERE name=$1 AND agency_id IS NULL`, [clean]);
    if (existing.rows.length > 0) {
      cache.units.set(key, existing.rows[0].id);
      return existing.rows[0].id;
    }
    const r = await pool.query(`INSERT INTO com_units(name, agency_id) VALUES($1, NULL) RETURNING id`, [clean]);
    cache.units.set(key, r.rows[0].id);
    return r.rows[0].id;
  }
  const r = await pool.query(
    `INSERT INTO com_units(name, agency_id) VALUES($1,$2) ON CONFLICT(name, agency_id) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
    [clean, agencyId]
  );
  cache.units.set(key, r.rows[0].id);
  return r.rows[0].id;
}

export async function ensureCom(
  pool: Pool, cache: RefCache,
  agencyId: number | null, unitId: number | null, comName: string
): Promise<number | null> {
  const clean = (comName ?? "").trim();
  if (!clean) return null;
  const key = `${agencyId ?? "null"}|${unitId ?? "null"}|${clean}`;
  const hit = cache.coms.get(key);
  if (hit) return hit;
  const existing = await pool.query(
    `SELECT id FROM coms WHERE name=$1 AND COALESCE(com_unit_id,-1)=COALESCE($2,-1) AND COALESCE(agency_id,-1)=COALESCE($3,-1)`,
    [clean, unitId, agencyId]
  );
  if (existing.rows.length > 0) {
    cache.coms.set(key, existing.rows[0].id);
    return existing.rows[0].id;
  }
  const r = await pool.query(
    `INSERT INTO coms(name, com_unit_id, agency_id) VALUES($1,$2,$3) RETURNING id`,
    [clean, unitId, agencyId]
  );
  cache.coms.set(key, r.rows[0].id);
  return r.rows[0].id;
}

/** Insertion par lots (multi-values) pour les détails dossiers. */
export async function batchInsertDetails(
  pool: Pool,
  table: "raw_dossier_details" | "raw_unarchived",
  importId: number,
  rows: {
    agencyId: number | null; unitId: number | null; comId: number | null;
    agencyName: string; unitName: string; comName: string;
    dossier: string; flags: Record<string, number>; mask: number;
  }[]
) {
  if (rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    chunk.forEach((r) => {
      values.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`
      );
      params.push(
        importId, r.agencyId, r.unitId, r.comId,
        r.agencyName || null, r.unitName || null, r.comName || null, r.dossier,
        r.flags.bae ?? 0, r.flags.factDouane ?? 0, r.flags.miseEnLivraison ?? 0,
        r.flags.livraison ?? 0, r.flags.retourConteneur ?? 0, r.flags.declaresNonFactures ?? 0,
        r.flags.factPrestation ?? 0, r.flags.archivage ?? 0, r.flags.sansDeclaration ?? 0,
        r.flags.debours ?? 0, r.mask ?? 0
      );
    });
    const sql = `INSERT INTO ${table}(import_id, agency_id, com_unit_id, com_id, agency_name, com_unit_name, com_name, dossier, bae, fact_douane, mise_en_livraison, livraison, retour_conteneur, declares_non_factures, fact_prestation, archivage, sans_declaration, debours, flags_mask) VALUES ${values.join(",")}`;
    // vérification : 19 colonnes
    await pool.query(sql, params);
  }
}

export async function batchInsertSummary(
  pool: Pool,
  importId: number,
  rows: {
    agencyId: number | null; unitId: number | null; comId: number | null;
    agencyName: string; unitName: string; comName: string;
    isSubtotal: boolean; dossiersValides: number | null; flags: Record<string, number>;
  }[]
) {
  if (rows.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  rows.forEach((r) => {
    values.push(
      `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`
    );
    params.push(
      importId, r.agencyId, r.unitId, r.comId,
      r.agencyName || null, r.unitName || null, r.comName || null,
      r.isSubtotal, r.dossiersValides,
      r.flags.bae ?? 0, r.flags.factDouane ?? 0, r.flags.miseEnLivraison ?? 0,
      r.flags.livraison ?? 0, r.flags.retourConteneur ?? 0, r.flags.declaresNonFactures ?? 0,
      r.flags.factPrestation ?? 0, r.flags.archivage ?? 0, r.flags.sansDeclaration ?? 0,
      r.flags.debours ?? 0
    );
  });
  // 18 colonnes listées ci-dessus (import_id ... debours)
  const sql = `INSERT INTO raw_com_summary(import_id, agency_id, com_unit_id, com_id, agency_name, com_unit_name, com_name, is_subtotal, dossiers_valides, bae, fact_douane, mise_en_livraison, livraison, retour_conteneur, declares_non_factures, fact_prestation, archivage, sans_declaration, debours) VALUES ${values.join(",")}`;
  await pool.query(sql, params);
}

export async function findDuplicateImport(
  pool: Pool, sha256: string, extractionDate: string
): Promise<{ byHash: number; byDate: number }> {
  const byHash = await pool.query(`SELECT COUNT(*)::int AS c FROM imports WHERE sha256=$1`, [sha256]);
  const byDate = await pool.query(`SELECT COUNT(*)::int AS c FROM imports WHERE extraction_date=$1::date`, [extractionDate]);
  return { byHash: Number(byHash.rows[0].c), byDate: Number(byDate.rows[0].c) };
}

export async function cleanupImportRows(pool: Pool, importId: number) {
  await pool.query(`DELETE FROM raw_dossier_details WHERE import_id=$1`, [importId]);
  await pool.query(`DELETE FROM raw_unarchived WHERE import_id=$1`, [importId]);
  await pool.query(`DELETE FROM raw_com_summary WHERE import_id=$1`, [importId]);
}

/**
 * Supprime un import chargé par erreur : ses lignes brutes (raw_dossier_details,
 * raw_unarchived, raw_com_summary) puis la ligne `imports` elle-même, dans une seule
 * transaction (les clés étrangères ne sont pas en cascade : un échec ne doit rien
 * laisser à moitié supprimé). Les référentiels partagés (agencies, com_units, coms)
 * ne sont jamais touchés : d'autres imports peuvent encore s'y référer.
 * Retourne la ligne supprimée (pour le message de confirmation), ou null si l'import
 * n'existait déjà plus.
 */
export async function deleteImport(pool: Pool, importId: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id, file_name AS "fileName", row_count AS "rowCount" FROM imports WHERE id=$1`,
      [importId]
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(`DELETE FROM raw_dossier_details WHERE import_id=$1`, [importId]);
    await client.query(`DELETE FROM raw_unarchived WHERE import_id=$1`, [importId]);
    await client.query(`DELETE FROM raw_com_summary WHERE import_id=$1`, [importId]);
    await client.query(`DELETE FROM imports WHERE id=$1`, [importId]);
    await client.query("COMMIT");
    return existing.rows[0] as { id: number; fileName: string; rowCount: number };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export function logStep(msg: string, fields?: Record<string, unknown>) {
  logger.info(msg, fields);
}
