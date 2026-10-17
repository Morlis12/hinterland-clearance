import { statSync } from "node:fs";
import { basename } from "node:path";
import type { Pool } from "pg";
import { logger } from "../logger";
import { streamFileBLight } from "./readBStream";
import {
  batchInsertDetails,
  cleanupImportRows,
  ensureAgency,
  ensureCom,
  ensureUnit,
  findDuplicateImport,
  newRefCache,
} from "./persist";
import { hashFile, toISODate, type ImportOptions, type ImportResult } from "./index";

// NOTE : module réservé au CLI (jamais bundlé pour le web).
// Il importe unzipper/saxes via readBStream — interdits dans ./index.ts.

/**
 * Détection légère depuis le chemin (ne charge JAMAIS tout le fichier :
 * lit uniquement xl/workbook.xml dans le zip). Indispensable pour le
 * Fichier B (41 Mo) qui sature la mémoire avec un lecteur DOM.
 */
export async function detectKindFromPath(filePath: string): Promise<{ kind: "A" | "B" | "unknown"; sheets: string[] }> {
  const { Open } = await import("unzipper");
  const dir = await Open.file(filePath);
  const entry = dir.files.find((f: { path: string }) => f.path === "xl/workbook.xml");
  if (!entry) return { kind: "unknown", sheets: [] };
  const xml = (await entry.buffer()).toString("utf8");
  const sheets: string[] = [];
  const re = /<sheet[^>]*name="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) sheets.push(m[1]);
  const lower = sheets.map((s) => s.toLowerCase());
  if (lower.includes("sheet1") && lower.includes("sheet2")) return { kind: "A", sheets };
  if (lower.includes("feuil1")) return { kind: "B", sheets };
  return { kind: "unknown", sheets };
}

/** Import du Fichier B depuis le disque en streaming (CLI uniquement). */
export async function importFileB(
  pool: Pool, filePath: string, opts: ImportOptions & { extractionDate: string }
): Promise<ImportResult> {
  const extractionDate = toISODate(opts.extractionDate);
  const stat = statSync(filePath);
  const sha = await hashFile(filePath);
  const fileName = basename(filePath);

  const duplicates = await findDuplicateImport(pool, sha, extractionDate);
  if ((duplicates.byHash > 0 || duplicates.byDate > 0) && !opts.force) {
    const e = new Error(
      `Un import existe déjà (même empreinte : ${duplicates.byHash}, même date d'extraction : ${duplicates.byDate}). Relancez avec --force pour conserver les deux imports.`
    ) as Error & { duplicate?: boolean };
    e.duplicate = true;
    throw e;
  }

  const warnings: string[] = [];
  if (duplicates.byHash > 0 || duplicates.byDate > 0) {
    warnings.push("Import en double confirmé (--force). Les deux imports sont conservés ; le plus récent fait foi.");
  }

  const ins = await pool.query(
    `INSERT INTO imports(file_name, sha256, file_type, extraction_date, row_count, status, warnings, origin) VALUES($1,$2,'B',$3::date,0,'success',$4,$5) RETURNING id`,
    [fileName, sha, extractionDate, JSON.stringify(warnings), opts.origin]
  );
  const importId = ins.rows[0].id as number;
  logger.info("import B démarré", { importId, fileName, extractionDate, sizeBytes: stat.size });

  const cache = newRefCache();
  try {
    let total = 0;
    const stats = await streamFileBLight(
      filePath,
      async (batch) => {
        const mapped = [];
        for (const d of batch) {
          const agencyId = d.agence ? await ensureAgency(pool, cache, d.agence) : null;
          const unitId = d.uniteCom ? await ensureUnit(pool, cache, agencyId, d.uniteCom) : null;
          const comId = d.com ? await ensureCom(pool, cache, agencyId, unitId, d.com) : null;
          mapped.push({
            agencyId, unitId, comId,
            agencyName: d.agence, unitName: d.uniteCom, comName: d.com,
            dossier: d.dossier, flags: d.flags, mask: d.mask,
          });
        }
        await batchInsertDetails(pool, "raw_unarchived", importId, mapped);
        total += batch.length;
        opts.onProgress?.(total, total);
      },
      { batchSize: opts.batchSize ?? 5000, onProgress: (read) => opts.onProgress?.(read, total) }
    );
    warnings.push(...stats.warnings);
    const status = warnings.length > 0 ? "warnings" : "success";
    await pool.query(`UPDATE imports SET row_count=$1, status=$2, warnings=$3 WHERE id=$4`, [
      stats.rowsInserted, status, JSON.stringify(warnings), importId,
    ]);
    logger.info("import B terminé", { importId, rows: stats.rowsInserted, status });
    return { importId, fileType: "B", extractionDate, rowCount: stats.rowsInserted, status, warnings, duplicates };
  } catch (e) {
    await cleanupImportRows(pool, importId);
    await pool.query(`UPDATE imports SET status='failed', warnings=$1 WHERE id=$2`, [
      JSON.stringify([...warnings, `Échec : ${String((e as Error).message)}`]), importId,
    ]);
    throw e;
  }
}
