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

export interface AggFilters {
  q?: string;
  agence?: string[];
  unite?: string[];
  com?: string[];
  categorie?: string[];
}

/** Clause WHERE (préfixée par AND) pour les agrégats de raw_dossier_details ; params numérotés à partir de p0. */
export function buildAggWhere(f: AggFilters, p0 = 2) {
  const params: unknown[] = [];
  const all: string[] = [];
  const geo: string[] = [];
  let p = p0;
  if (f.agence?.length) { all.push(`agency_name = ANY($${p})`); geo.push(`agency_name = ANY($${p})`); params.push(f.agence); p++; }
  if (f.unite?.length) { all.push(`com_unit_name = ANY($${p})`); geo.push(`com_unit_name = ANY($${p})`); params.push(f.unite); p++; }
  if (f.com?.length) { all.push(`com_name = ANY($${p})`); geo.push(`com_name = ANY($${p})`); params.push(f.com); p++; }
  if (f.q) { all.push(`(dossier ILIKE $${p} OR com_name ILIKE $${p})`); params.push(`%${f.q}%`); p++; }
  const catCols = (f.categorie ?? []).map((c) => CAT_COLUMNS[c]).filter(Boolean);
  if (catCols.length) all.push(`(${catCols.map((c) => `${c}=1`).join(" OR ")})`);
  return {
    all: all.length ? " AND " + all.join(" AND ") : "",
    geo: geo.length ? " AND " + geo.join(" AND ") : "",
    params,
    next: p,
  };
}

export async function filterOptions(pool: Pool, importId: number) {
  const r = await pool.query(
    `SELECT DISTINCT agency_name, com_unit_name, com_name FROM raw_dossier_details WHERE import_id=$1`,
    [importId]
  );
  const agences = [...new Set(r.rows.map((x) => x.agency_name).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "fr")) as string[];
  const unites = [...new Set(r.rows.map((x) => x.com_unit_name).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "fr")) as string[];
  const coms = [...new Set(r.rows.map((x) => x.com_name).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "fr")) as string[];
  return { agences, unites, coms };
}

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
export async function dashboardKpis(pool: Pool, importId: number, f: AggFilters = {}) {
  const w = buildAggWhere(f);
  const catSums = CATEGORIES.map((c) => `COALESCE(SUM(${CAT_COLUMNS[c.key]}),0)::int AS "${c.key}"`).join(", ");
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total, ${catSums} FROM raw_dossier_details WHERE import_id=$1${w.all}`,
    [importId, ...w.params]
  );
  const row = r.rows[0];
  // Total dossiers en retard = dossiers ayant au moins une catégorie (tous normalement, mais on vérifie)
  const r2 = await pool.query(
    `SELECT COUNT(*)::int AS c FROM raw_dossier_details WHERE import_id=$1 AND flags_mask <> 0${w.all}`,
    [importId, ...w.params]
  );
  return { ...row, totalAvecRetard: r2.rows[0].c };
}

/** Top COM par nombre de dossiers en retard. */
export async function topComs(pool: Pool, importId: number, limit = 15, f: AggFilters = {}) {
  const w = buildAggWhere(f);
  const r = await pool.query(
    `SELECT COALESCE(com_name,'(inconnu)') AS com, COALESCE(com_unit_name,'') AS unite, COALESCE(agency_name,'') AS agence,
      COUNT(*)::int AS total,
      COALESCE(SUM(bae),0)::int AS bae, COALESCE(SUM(fact_douane),0)::int AS "factDouane",
      COALESCE(SUM(mise_en_livraison),0)::int AS "miseEnLivraison", COALESCE(SUM(livraison),0)::int AS livraison,
      COALESCE(SUM(retour_conteneur),0)::int AS "retourConteneur",
      COALESCE(SUM(declares_non_factures),0)::int AS "declaresNonFactures",
      COALESCE(SUM(fact_prestation),0)::int AS "factPrestation", COALESCE(SUM(archivage),0)::int AS archivage,
      COALESCE(SUM(sans_declaration),0)::int AS "sansDeclaration", COALESCE(SUM(debours),0)::int AS debours
     FROM raw_dossier_details WHERE import_id=$1${w.all}
     GROUP BY com_name, com_unit_name, agency_name ORDER BY total DESC LIMIT $${w.next}`,
    [importId, ...w.params, limit]
  );
  return r.rows;
}

/** Matrice par COM avec dossiers validés (Sheet1) + retards (Sheet2). */
export async function comMatrix(pool: Pool, importId: number, f: AggFilters = {}) {
  const w = buildAggWhere(f);
  const r = await pool.query(
    `WITH val AS (
       SELECT com_name, com_unit_name, agency_name, MAX(dossiers_valides) AS valides
       FROM raw_com_summary WHERE import_id=$1 AND is_subtotal=false${w.geo} GROUP BY 1,2,3
     ),
     ret AS (
       SELECT com_name, com_unit_name, agency_name, COUNT(*)::int AS total,
        COALESCE(SUM(bae),0)::int AS bae, COALESCE(SUM(fact_douane),0)::int AS "factDouane",
        COALESCE(SUM(mise_en_livraison),0)::int AS "miseEnLivraison", COALESCE(SUM(livraison),0)::int AS livraison,
        COALESCE(SUM(retour_conteneur),0)::int AS "retourConteneur",
        COALESCE(SUM(declares_non_factures),0)::int AS "declaresNonFactures",
        COALESCE(SUM(fact_prestation),0)::int AS "factPrestation", COALESCE(SUM(archivage),0)::int AS archivage,
        COALESCE(SUM(sans_declaration),0)::int AS "sansDeclaration", COALESCE(SUM(debours),0)::int AS debours
       FROM raw_dossier_details WHERE import_id=$1${w.all} GROUP BY 1,2,3
     )
     SELECT COALESCE(ret.com_name, val.com_name) AS com,
       COALESCE(val.com_unit_name, ret.com_unit_name, '') AS "uniteCom",
       COALESCE(val.agency_name, ret.agency_name, '') AS agence,
       val.valides AS "dossiersValides",
       COALESCE(ret.total,0) AS total, COALESCE(ret.bae,0) AS bae,
       COALESCE(ret."factDouane",0) AS "factDouane", COALESCE(ret."miseEnLivraison",0) AS "miseEnLivraison",
       COALESCE(ret.livraison,0) AS livraison, COALESCE(ret."retourConteneur",0) AS "retourConteneur",
       COALESCE(ret."declaresNonFactures",0) AS "declaresNonFactures",
       COALESCE(ret."factPrestation",0) AS "factPrestation", COALESCE(ret.archivage,0) AS archivage,
       COALESCE(ret."sansDeclaration",0) AS "sansDeclaration", COALESCE(ret.debours,0) AS debours
     FROM ret FULL OUTER JOIN val
       ON COALESCE(ret.com_name,'') = COALESCE(val.com_name,'')
      AND COALESCE(ret.com_unit_name,'') = COALESCE(val.com_unit_name,'')
      AND COALESCE(ret.agency_name,'') = COALESCE(val.agency_name,'')
      ORDER BY total DESC, com`,
    [importId, ...w.params]
  );
  return r.rows;
}

export interface DossierFilters {
  q?: string;
  agence?: string[];
  unite?: string[];
  com?: string[];
  categorie?: string[];
  page?: number;
  pageSize?: number;
  maxPageSize?: number;
  sort?: string;
  dir?: "asc" | "desc";
}

const SORTABLE = new Set(["dossier", "agence", "com", "unite", "categorie", "id"]);

export async function queryDossiers(pool: Pool, importId: number, f: DossierFilters) {
  const page = Math.max(1, Number(f.page ?? 1));
  const maxPageSize = Math.max(5, Number(f.maxPageSize ?? 200));
  const pageSize = Math.min(maxPageSize, Math.max(5, Number(f.pageSize ?? 50)));
  const where: string[] = [`import_id=$1`];
  const params: unknown[] = [importId];
  let p = 2;
  if (f.q) { where.push(`(dossier ILIKE $${p} OR com_name ILIKE $${p})`); params.push(`%${f.q}%`); p++; }
  if (f.agence?.length) { where.push(`agency_name = ANY($${p})`); params.push(f.agence); p++; }
  if (f.unite?.length) { where.push(`com_unit_name = ANY($${p})`); params.push(f.unite); p++; }
  if (f.com?.length) { where.push(`com_name = ANY($${p})`); params.push(f.com); p++; }
  const catCols = (f.categorie ?? []).map((c) => CAT_COLUMNS[c]).filter(Boolean);
  if (catCols.length) where.push(`(${catCols.map((c) => `${c}=1`).join(" OR ")})`);
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

export async function evolutionCompare(pool: Pool, idA: number, idB: number, f: AggFilters = {}) {
  // idA = N-1 (ancien), idB = N (récent)
  const catSums = (alias: string) =>
    CATEGORIES.map((c) => `COALESCE(SUM(${alias}.${CAT_COLUMNS[c.key]}),0)::int AS "${c.key}"`).join(", ");
  const wA = buildAggWhere(f, 2);
  const wB = buildAggWhere(f, 2);
  const wC = buildAggWhere(f, 3);
  const a = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE d.flags_mask <> 0)::int AS "totalAvecRetard", ${catSums("d")} FROM raw_dossier_details d WHERE import_id=$1${wA.all}`, [idA, ...wA.params]);
  const b = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE d.flags_mask <> 0)::int AS "totalAvecRetard", ${catSums("d")} FROM raw_dossier_details d WHERE import_id=$1${wB.all}`, [idB, ...wB.params]);
  const byCom = await pool.query(
    `WITH a AS (SELECT com_name AS com, COUNT(*)::int AS total FROM raw_dossier_details WHERE import_id=$1${wC.all} GROUP BY 1),
          b AS (SELECT com_name AS com, COUNT(*)::int AS total FROM raw_dossier_details WHERE import_id=$2${wC.all} GROUP BY 1)
     SELECT COALESCE(a.com,b.com) AS com, COALESCE(a.total,0) AS ancien, COALESCE(b.total,0) AS recent,
       COALESCE(b.total,0)-COALESCE(a.total,0) AS variation
     FROM a FULL OUTER JOIN b ON a.com=b.com ORDER BY variation DESC`,
    [idA, idB, ...wC.params]
  );
  return { ancien: a.rows[0], recent: b.rows[0], parCom: byCom.rows };
}

/** Évolution de tous les KPI sur l'ensemble des extractions A (dates d'extraction et de chargement incluses). */
export async function trendsAll(pool: Pool, f: AggFilters = {}) {
  const w = buildAggWhere(f, 1);
  const catSums = CATEGORIES.map((c) => `COALESCE(SUM(d.${CAT_COLUMNS[c.key]}),0)::int AS "${c.key}"`).join(", ");
  const r = await pool.query(
    `SELECT i.id, i.file_name, i.extraction_date, i.loaded_at, i.origin,
       COUNT(d.*)::int AS total, COUNT(d.*) FILTER (WHERE d.flags_mask <> 0)::int AS "totalAvecRetard", ${catSums}
     FROM imports i
     LEFT JOIN raw_dossier_details d ON d.import_id = i.id${w.all.replace(/agency_name|com_unit_name|com_name|dossier|bae|fact_douane|mise_en_livraison|livraison|retour_conteneur|declares_non_factures|fact_prestation|archivage|sans_declaration|debours/g, (m) => `d.${m}`)}
     WHERE i.file_type='A' AND i.status IN ('success','warnings')
     GROUP BY i.id ORDER BY i.extraction_date ASC, i.id ASC`,
    w.params
  );
  return r.rows;
}
