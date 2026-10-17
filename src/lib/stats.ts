import type { Pool } from "pg";
import { CATEGORIES } from "./import/constants";

export const CAT_COLUMNS: Record<string, string> = {
  bae: "bae",
  factDouane: "fact_douane",
  miseEnLivraison: "mise_en_livraison",
  livraison: "livraison",
  retourConteneur: "retour_conteneur",
  declaresNonFactures: "declares_non_factures",
  factPrestation: "fact_prestation",
  archivage: "archivage",
  sansDeclaration: "sans_declaration",
  debours: "debours",
};

export async function latestSnapshotId(pool: Pool, fileType = "A"): Promise<number | null> {
  const r = await pool.query(
    `SELECT id FROM imports WHERE status IN ('success','warnings') AND file_type=$1 ORDER BY extraction_date DESC, id DESC LIMIT 1`,
    [fileType]
  );
  return r.rows.length ? r.rows[0].id : null;
}

export async function listSnapshots(pool: Pool, fileType?: string) {
  if (fileType) {
    const r = await pool.query(
      `SELECT id, file_name, file_type, extraction_date, loaded_at, row_count, status, origin FROM imports WHERE file_type=$1 ORDER BY extraction_date DESC, id DESC`,
      [fileType]
    );
    return r.rows;
  }
  const r = await pool.query(
    `SELECT id, file_name, file_type, extraction_date, loaded_at, row_count, status, origin FROM imports ORDER BY extraction_date DESC, id DESC`
  );
  return r.rows;
}

/** KPI du dashboard pour un snapshot : total dossiers distincts + par catégorie. */
export async function dashboardKpis(pool: Pool, importId: number) {
  const catSums = CATEGORIES.map((c) => `COALESCE(SUM(${CAT_COLUMNS[c.key]}),0)::int AS "${c.key}"`).join(", ");
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total, ${catSums} FROM raw_dossier_details WHERE import_id=$1`,
    [importId]
  );
  const row = r.rows[0];
  // Total dossiers en retard = dossiers ayant au moins une catégorie (tous normalement, mais on vérifie)
  const r2 = await pool.query(
    `SELECT COUNT(*)::int AS c FROM raw_dossier_details WHERE import_id=$1 AND flags_mask <> 0`,
    [importId]
  );
  return { ...row, totalAvecRetard: r2.rows[0].c };
}

/** Top COM par nombre de dossiers en retard. */
export async function topComs(pool: Pool, importId: number, limit = 15) {
  const r = await pool.query(
    `SELECT COALESCE(com_name,'(inconnu)') AS com, COALESCE(com_unit_name,'') AS unite, COALESCE(agency_name,'') AS agence,
      COUNT(*)::int AS total,
      COALESCE(SUM(bae),0)::int AS bae, COALESCE(SUM(fact_douane),0)::int AS "factDouane",
      COALESCE(SUM(mise_en_livraison),0)::int AS "miseEnLivraison", COALESCE(SUM(livraison),0)::int AS livraison,
      COALESCE(SUM(retour_conteneur),0)::int AS "retourConteneur",
      COALESCE(SUM(declares_non_factures),0)::int AS "declaresNonFactures",
      COALESCE(SUM(fact_prestation),0)::int AS "factPrestation", COALESCE(SUM(archivage),0)::int AS archivage,
      COALESCE(SUM(sans_declaration),0)::int AS "sansDeclaration", COALESCE(SUM(debours),0)::int AS debours
     FROM raw_dossier_details WHERE import_id=$1
     GROUP BY com_name, com_unit_name, agency_name ORDER BY total DESC LIMIT $2`,
    [importId, limit]
  );
  return r.rows;
}

/** Matrice par COM avec dossiers validés (Sheet1) + retards (Sheet2). */
export async function comMatrix(pool: Pool, importId: number) {
  const r = await pool.query(
    `WITH val AS (
       SELECT com_name, com_unit_name, agency_name, MAX(dossiers_valides) AS valides
       FROM raw_com_summary WHERE import_id=$1 AND is_subtotal=false GROUP BY 1,2,3
     ),
     ret AS (
       SELECT com_name, COUNT(*)::int AS total,
        COALESCE(SUM(bae),0)::int AS bae, COALESCE(SUM(fact_douane),0)::int AS "factDouane",
        COALESCE(SUM(mise_en_livraison),0)::int AS "miseEnLivraison", COALESCE(SUM(livraison),0)::int AS livraison,
        COALESCE(SUM(retour_conteneur),0)::int AS "retourConteneur",
        COALESCE(SUM(declares_non_factures),0)::int AS "declaresNonFactures",
        COALESCE(SUM(fact_prestation),0)::int AS "factPrestation", COALESCE(SUM(archivage),0)::int AS archivage,
        COALESCE(SUM(sans_declaration),0)::int AS "sansDeclaration", COALESCE(SUM(debours),0)::int AS debours
       FROM raw_dossier_details WHERE import_id=$1 GROUP BY 1
     )
     SELECT COALESCE(ret.com_name, val.com_name) AS com,
       COALESCE(val.com_unit_name,'') AS "uniteCom", COALESCE(val.agency_name,'') AS agence,
       val.valides AS "dossiersValides",
       COALESCE(ret.total,0) AS total, COALESCE(ret.bae,0) AS bae,
       COALESCE(ret."factDouane",0) AS "factDouane", COALESCE(ret."miseEnLivraison",0) AS "miseEnLivraison",
       COALESCE(ret.livraison,0) AS livraison, COALESCE(ret."retourConteneur",0) AS "retourConteneur",
       COALESCE(ret."declaresNonFactures",0) AS "declaresNonFactures",
       COALESCE(ret."factPrestation",0) AS "factPrestation", COALESCE(ret.archivage,0) AS archivage,
       COALESCE(ret."sansDeclaration",0) AS "sansDeclaration", COALESCE(ret.debours,0) AS debours
     FROM ret FULL OUTER JOIN val ON ret.com_name = val.com_name
     ORDER BY total DESC`,
    [importId]
  );
  return r.rows;
}

export interface DossierFilters {
  q?: string;
  agence?: string;
  unite?: string;
  com?: string;
  categorie?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: "asc" | "desc";
}

const SORTABLE = new Set(["dossier", "agence", "com", "unite", "categorie", "id"]);

export async function queryDossiers(pool: Pool, importId: number, f: DossierFilters) {
  const page = Math.max(1, Number(f.page ?? 1));
  const pageSize = Math.min(200, Math.max(5, Number(f.pageSize ?? 50)));
  const where: string[] = [`import_id=$1`];
  const params: unknown[] = [importId];
  let p = 2;
  if (f.q) { where.push(`(dossier ILIKE $${p} OR com_name ILIKE $${p})`); params.push(`%${f.q}%`); p++; }
  if (f.agence) { where.push(`agency_name=$${p}`); params.push(f.agence); p++; }
  if (f.unite) { where.push(`com_unit_name=$${p}`); params.push(f.unite); p++; }
  if (f.com) { where.push(`com_name=$${p}`); params.push(f.com); p++; }
  if (f.categorie && CAT_COLUMNS[f.categorie]) { where.push(`${CAT_COLUMNS[f.categorie]}=1`); p; }
  const sortKey = SORTABLE.has(f.sort ?? "") ? (f.sort as string) : "dossier";
  const sortCol =
    sortKey === "dossier" ? "dossier" : sortKey === "agence" ? "agency_name" :
    sortKey === "com" ? "com_name" : sortKey === "unite" ? "com_unit_name" : "dossier";
  const dir = f.dir === "desc" ? "DESC" : "ASC";
  const count = await pool.query(
    `SELECT COUNT(*)::int AS c FROM raw_dossier_details WHERE ${where.join(" AND ")}`, params
  );
  const total = count.rows[0].c as number;
  const rows = await pool.query(
    `SELECT dossier, agency_name AS agence, com_unit_name AS unite, com_name AS com,
      bae, fact_douane AS "factDouane", mise_en_livraison AS "miseEnLivraison", livraison,
      retour_conteneur AS "retourConteneur", declares_non_factures AS "declaresNonFactures",
      fact_prestation AS "factPrestation", archivage, sans_declaration AS "sansDeclaration", debours
     FROM raw_dossier_details WHERE ${where.join(" AND ")} ORDER BY ${sortCol} ${dir} LIMIT $${p} OFFSET $${p + 1}`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), rows: rows.rows };
}

export async function evolutionCompare(pool: Pool, idA: number, idB: number) {
  // idA = N-1 (ancien), idB = N (récent)
  const catSums = (alias: string) =>
    CATEGORIES.map((c) => `COALESCE(SUM(${alias}.${CAT_COLUMNS[c.key]}),0)::int AS "${c.key}"`).join(", ");
  const a = await pool.query(`SELECT COUNT(*)::int AS total, ${catSums("d")} FROM raw_dossier_details d WHERE import_id=$1`, [idA]);
  const b = await pool.query(`SELECT COUNT(*)::int AS total, ${catSums("d")} FROM raw_dossier_details d WHERE import_id=$1`, [idB]);
  const byCom = await pool.query(
    `WITH a AS (SELECT com_name AS com, COUNT(*)::int AS total FROM raw_dossier_details WHERE import_id=$1 GROUP BY 1),
          b AS (SELECT com_name AS com, COUNT(*)::int AS total FROM raw_dossier_details WHERE import_id=$2 GROUP BY 1)
     SELECT COALESCE(a.com,b.com) AS com, COALESCE(a.total,0) AS ancien, COALESCE(b.total,0) AS recent,
       COALESCE(b.total,0)-COALESCE(a.total,0) AS variation
     FROM a FULL OUTER JOIN b ON a.com=b.com ORDER BY variation DESC`,
    [idA, idB]
  );
  return { ancien: a.rows[0], recent: b.rows[0], parCom: byCom.rows };
}
