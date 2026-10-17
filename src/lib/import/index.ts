import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import * as XLSX from "xlsx";
import type { Pool } from "pg";
import { logger } from "../logger";
import { parseFileA } from "./readA";
import {
  batchInsertDetails,
  batchInsertSummary,
  cleanupImportRows,
  ensureAgency,
  ensureCom,
  ensureUnit,
  findDuplicateImport,
  newRefCache,
} from "./persist";

// NOTE : ce module est bundlé pour le web (route /api/import) — il ne doit
// JAMAIS importer unzipper/saxes (réservés au CLI, voir ./cli.ts).

export interface ImportOptions {
  origin: "web" | "cli";
  force?: boolean;
  extractionDateOverride?: string; // AAAA-MM-JJ (obligatoire pour B)
  batchSize?: number;
  onProgress?: (read: number, inserted: number) => void;
}

export interface ImportResult {
  importId: number;
  fileType: "A" | "B";
  extractionDate: string;
  rowCount: number;
  status: "success" | "warnings" | "failed";
  warnings: string[];
  duplicates: { byHash: number; byDate: number };
}

/** Détection du type de fichier depuis un buffer (SheetJS, léger — Fichier A uniquement). */
export async function detectKindFromBuffer(buffer: Buffer): Promise<{ kind: "A" | "B" | "unknown"; sheets: string[] }> {
  const wb = XLSX.read(buffer, { type: "buffer", bookSheets: true });
  const sheets: string[] = wb.SheetNames;
  const lower = sheets.map((s: string) => s.toLowerCase());
  if (lower.includes("sheet1") && lower.includes("sheet2")) return { kind: "A", sheets };
  if (lower.includes("feuil1")) return { kind: "B", sheets };
  return { kind: "unknown", sheets };
}

export function toISODate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Date invalide (attendue AAAA-MM-JJ) : ${d}`);
  return d;
}

export async function hashFile(filePath: string): Promise<string> {
  const { createReadStream } = await import("node:fs");
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const s = createReadStream(filePath);
    s.on("data", (d) => hash.update(d as Buffer));
    s.on("end", () => resolve());
    s.on("error", reject);
  });
  return hash.digest("hex");
}

/** Import du Fichier A depuis un buffer (utilisé par l'API web ET le CLI). */
export async function importBufferA(
  pool: Pool, buffer: Buffer, fileName: string, opts: ImportOptions
): Promise<ImportResult> {
  const parsed = await parseFileA(buffer, fileName);
  if (parsed.errors.length > 0) {
    // Enregistrer l'échec dans l'historique (sans lignes)
    const sha = parsed.sha256;
    const extDate = parsed.extractionDate || "1970-01-01";
    const r = await pool.query(
      `INSERT INTO imports(file_name, sha256, file_type, extraction_date, row_count, status, warnings, origin) VALUES($1,$2,'A',$3::date,0,'failed',$4,$5) RETURNING id`,
      [fileName, sha, extDate, JSON.stringify(parsed.errors.concat(parsed.warnings)), opts.origin]
    );
    throw Object.assign(new Error(parsed.errors.join(" ")), { importId: r.rows[0].id, warnings: parsed.warnings });
  }

  const extractionDate = opts.extractionDateOverride
    ? toISODate(opts.extractionDateOverride)
    : parsed.extractionDate;
  if (!extractionDate) throw new Error("Date d'extraction introuvable et non fournie en paramètre.");

  const duplicates = await findDuplicateImport(pool, parsed.sha256, extractionDate);
  if ((duplicates.byHash > 0 || duplicates.byDate > 0) && !opts.force) {
    const e = new Error(
      `Un import existe déjà (même empreinte : ${duplicates.byHash}, même date d'extraction : ${duplicates.byDate}). Relancez avec confirmation (force) pour conserver les deux imports.`
    ) as Error & { duplicate?: boolean; duplicates?: typeof duplicates };
    e.duplicate = true;
    e.duplicates = duplicates;
    throw e;
  }

  const allWarnings = [...parsed.warnings];
  if (duplicates.byHash > 0 || duplicates.byDate > 0) {
    allWarnings.push(`Import en double confirmé par l'utilisateur (même empreinte : ${duplicates.byHash}, même date : ${duplicates.byDate}). Les deux imports sont conservés ; le plus récent fait foi.`);
  }

  const ins = await pool.query(
    `INSERT INTO imports(file_name, sha256, file_type, extraction_date, row_count, status, warnings, origin) VALUES($1,$2,'A',$3::date,0,'success',$4,$5) RETURNING id`,
    [fileName, parsed.sha256, extractionDate, JSON.stringify(allWarnings), opts.origin]
  );
  const importId = ins.rows[0].id as number;

  try {
    const cache = newRefCache();
    // Résumé + sous-totaux
    const allSummary = [...parsed.summaryRows, ...parsed.subtotalRows];
    const summaryMapped: {
      agencyId: number | null; unitId: number | null; comId: number | null;
      agencyName: string; unitName: string; comName: string;
      isSubtotal: boolean; dossiersValides: number | null; flags: Record<string, number>;
    }[] = [];
    for (const s of allSummary) {
      const agencyId = s.agence ? await ensureAgency(pool, cache, s.agence) : null;
      const unitId = s.uniteCom ? await ensureUnit(pool, cache, agencyId, s.uniteCom) : null;
      const comId = !s.isSubtotal && s.com ? await ensureCom(pool, cache, agencyId, unitId, s.com) : null;
      summaryMapped.push({
        agencyId, unitId, comId,
        agencyName: s.agence, unitName: s.uniteCom, comName: s.com,
        isSubtotal: s.isSubtotal, dossiersValides: s.dossiersValides, flags: s.flags,
      });
    }
    await batchInsertSummary(pool, importId, summaryMapped);

    // Détail dossiers par lots
    const BATCH = opts.batchSize ?? 2000;
    let inserted = 0;
    for (let i = 0; i < parsed.detailRows.length; i += BATCH) {
      const slice = parsed.detailRows.slice(i, i + BATCH);
      const mapped = [];
      for (const d of slice) {
        const agencyId = d.agence ? await ensureAgency(pool, cache, d.agence) : null;
        const unitId = d.uniteCom ? await ensureUnit(pool, cache, agencyId, d.uniteCom) : null;
        const comId = d.com ? await ensureCom(pool, cache, agencyId, unitId, d.com) : null;
        mapped.push({
          agencyId, unitId, comId,
          agencyName: d.agence, unitName: d.uniteCom, comName: d.com,
          dossier: d.dossier, flags: d.flags, mask: d.mask,
        });
      }
      await batchInsertDetails(pool, "raw_dossier_details", importId, mapped);
      inserted += slice.length;
      opts.onProgress?.(parsed.detailRows.length, inserted);
    }

    const status = allWarnings.length > 0 ? "warnings" : "success";
    await pool.query(`UPDATE imports SET row_count=$1, status=$2, warnings=$3 WHERE id=$4`, [
      parsed.detailRows.length, status, JSON.stringify(allWarnings), importId,
    ]);
    logger.info("import A terminé", { importId, fileName, extractionDate, rows: parsed.detailRows.length, status });
    return { importId, fileType: "A", extractionDate, rowCount: parsed.detailRows.length, status, warnings: allWarnings, duplicates };
  } catch (e) {
    await cleanupImportRows(pool, importId);
    await pool.query(`UPDATE imports SET status='failed', warnings=$1 WHERE id=$2`, [
      JSON.stringify([...allWarnings, `Échec : ${String((e as Error).message)}`]), importId,
    ]);
    throw e;
  }
}

/** Import du Fichier A depuis le disque (CLI). */
export async function importFileA(
  pool: Pool, filePath: string, opts: ImportOptions
): Promise<ImportResult> {
  const buffer = readFileSync(filePath);
  return importBufferA(pool, buffer, basename(filePath), opts);
}
