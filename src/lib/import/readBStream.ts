/**
 * Lecture en streaming du Fichier B (Feuil1, >1M lignes) SANS ExcelJS.
 * Pourquoi : ExcelJS (même en mode streaming) dépasse la mémoire Node sur ce
 * fichier (~41 Mo compressés, >1M lignes). On parse directement le XML de la
 * feuille via unzipper + saxes, ligne par ligne, sans rien garder en mémoire
 * hormis le lot courant.
 */
import { Open } from "unzipper";
import { SaxesParser } from "saxes";
import { CATEGORIES, flagToInt, maskFromFlags, normalizeHeader, NON_AFFECTE } from "./constants";
import { locateDetailColumns } from "./detect";

export interface StreamStats {
  rowsRead: number;
  rowsInserted: number;
  rowsSkippedEmpty: number;
  totalRowSkipped: number;
  withoutCom: number;
  duplicates: number;
  warnings: string[];
}

export type DetailBatchRow = {
  agence: string; uniteCom: string; com: string; dossier: string;
  flags: Record<string, number>; mask: number;
};

function colLettersToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

async function readSharedStrings(filePath: string): Promise<string[]> {
  const dir = await Open.file(filePath);
  const entry = dir.files.find((f) => f.path === "xl/sharedStrings.xml");
  if (!entry) return [];
  const xml = (await entry.buffer()).toString("utf8");
  // Extraction simple des <t>…</t> dans l'ordre (suffisant pour ce fichier)
  const out: string[] = [];
  const re = /<t[^>]*>([^<]*)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'"));
  }
  return out;
}

export async function streamFileBLight(
  filePath: string,
  onBatch: (rows: DetailBatchRow[]) => Promise<void>,
  opts: { batchSize?: number; onProgress?: (read: number) => void } = {}
): Promise<StreamStats> {
  const batchSize = opts.batchSize ?? 5000;
  const shared = await readSharedStrings(filePath);
  const stats: StreamStats = {
    rowsRead: 0, rowsInserted: 0, rowsSkippedEmpty: 0,
    totalRowSkipped: 0, withoutCom: 0, duplicates: 0, warnings: [],
  };
  const seen = new Set<string>();
  let dupCount = 0;
  let batch: DetailBatchRow[] = [];
  let colMap: { agence: number; uniteCom: number; com: number; dossier: number; categories: Record<string, number> } | null = null;
  let hasValidesCol = false;

  const dir = await Open.file(filePath);
  const sheet =
    dir.files.find((f) => f.path === "xl/worksheets/sheet1.xml") ??
    dir.files.find((f) => /^xl\/worksheets\/sheet.*\.xml$/.test(f.path));
  if (!sheet) throw new Error("Feuille introuvable dans le classeur.");

  await new Promise<void>((resolve, reject) => {
    const parser: any = new (SaxesParser as any)();
    let inRow = false;
    let currentRowNum = 0;
    let currentCells = new Map<number, string>();
    let currentCellCol = 0;
    let currentCellType: string | null = null;
    let currentValue = "";
    let currentInline = "";
    let inV = false;
    let inInlineT = false;
    let finished = false;
    const pending: Promise<void>[] = [];
    // NOTE : les cellules et le n° de ligne sont capturés de façon synchrone
    // dans le handler closetag (sinon la mutation par la ligne suivante fausse tout).
    const finishRow = (cells: Map<number, string>, rowNum: number) => {
      const p = (async () => {
        try {
        if (rowNum === 1) {
          const maxC = Math.max(...[...cells.keys(), 15]);
          const headers: unknown[] = [];
          for (let c = 1; c <= maxC; c++) headers.push(cells.get(c) ?? null);
          const { cols, missing } = locateDetailColumns(headers as unknown[], { requireDossiersValides: false });
          if (!cols) throw new Error(`Feuil1 : colonnes obligatoires manquantes (ligne 1) : ${missing.join(", ")}.`);
          hasValidesCol = (headers as unknown[]).map((h) => normalizeHeader(h)).some((h) => h.includes("dossiers valides"));
          if (hasValidesCol) throw new Error("Ce fichier ressemble au Fichier A (colonne « Dossiers Validés » présente).");
          colMap = { agence: cols.agence, uniteCom: cols.uniteCom, com: cols.com, dossier: cols.dossier, categories: cols.categories };
        } else if (rowNum === 2) {
          // ligne des en-têtes anglais : ignorée
        } else if (colMap && rowNum >= 3) {
          stats.rowsRead++;
          const get = (col: number) => (cells.get(col) ?? "").trim();
          const agence = get(colMap.agence);
          const unite = get(colMap.uniteCom);
          const com = get(colMap.com);
          const dossier = get(colMap.dossier);
          const anyFlag = Object.values(colMap.categories).some((c) => get(c) !== "");
          if (!dossier && !agence && !unite && !com) {
            if (anyFlag) stats.totalRowSkipped++;
            else stats.rowsSkippedEmpty++;
          } else if (!dossier) {
            stats.rowsSkippedEmpty++;
          } else if (!agence && !unite && !com) {
            stats.totalRowSkipped++;
          } else {
            const flags: Record<string, number> = {};
            for (const c of CATEGORIES) flags[c.key] = flagToInt(get(colMap.categories[c.key]));
            const finalCom = com || NON_AFFECTE;
            if (!com && !unite) stats.withoutCom++;
            if (seen.size < 2000000) {
              if (seen.has(dossier)) dupCount++;
              else seen.add(dossier);
            }
            batch.push({ agence, uniteCom: unite, com: finalCom, dossier, flags, mask: maskFromFlags(flags) });
            if (batch.length >= batchSize) {
              const toSend = batch; batch = [];
              await onBatch(toSend);
              stats.rowsInserted += toSend.length;
              opts.onProgress?.(stats.rowsRead);
            }
            if (stats.rowsRead % 200000 === 0) opts.onProgress?.(stats.rowsRead);
          }
        }
      } catch (e) {
        finished = true;
        throw e;
      }
      })();
      pending.push(p);
      p.catch((e) => reject(e));
    };

    const queue: Array<() => Promise<void>> = [];
    void queue;

    parser.on("opentag", (tag: any) => {
      if (finished) return;
      if (tag.name === "row") {
        inRow = true;
        currentRowNum = Number(tag.attributes.r ?? currentRowNum + 1);
        currentCells = new Map();
      } else if (inRow && tag.name === "c") {
        const ref = String(tag.attributes.r ?? "");
        const m = ref.match(/^([A-Z]+)(\d+)$/);
        currentCellCol = m ? colLettersToNumber(m[1]) : 0;
        currentCellType = tag.attributes.t ? String(tag.attributes.t) : null;
        currentValue = ""; currentInline = "";
      } else if (inRow && tag.name === "v") {
        inV = true; currentValue = "";
      } else if (inRow && tag.name === "t") {
        inInlineT = true; currentInline = "";
      }
    });
    parser.on("text", (t: string) => {
      if (inV) currentValue += t;
      else if (inInlineT) currentInline += t;
    });
    parser.on("closetag", (tag: any) => {
      const name: string = typeof tag === "string" ? tag : tag?.name;
      if (name === "v") inV = false;
      else if (name === "t") inInlineT = false;
      else if (name === "c") {
        let val = "";
        if (currentCellType === "s") {
          const idx = Number(currentValue);
          val = Number.isFinite(idx) && shared[idx] !== undefined ? shared[idx] : "";
        } else if (currentCellType === "inlineStr") {
          val = currentInline;
        } else if (currentCellType === "str" || currentCellType === null) {
          val = currentValue !== "" ? currentValue : currentInline;
        } else {
          val = currentValue;
        }
        if (currentCellCol > 0) currentCells.set(currentCellCol, val);
      } else if (name === "row") {
        inRow = false;
        finishRow(new Map(currentCells), currentRowNum);
      }
    });
    parser.on("end", async () => {
      try {
        await Promise.all(pending);
        if (batch.length > 0) {
          await onBatch(batch);
          stats.rowsInserted += batch.length;
          batch = [];
          opts.onProgress?.(stats.rowsRead);
        }
        resolve();
      } catch (e) { reject(e); }
    });
    parser.on("error", (e: any) => { if (!finished) { finished = true; reject(e); } });

    const stream = sheet.stream();
    stream.on("data", (chunk: Buffer) => parser.write(chunk.toString("utf8")));
    stream.on("end", () => parser.close());
    stream.on("error", (e: Error) => { finished = true; reject(e); });
  });

  stats.duplicates = dupCount;
  if (stats.withoutCom > 0) stats.warnings.push(`${stats.withoutCom} ligne(s) sans COM regroupées sous « ${NON_AFFECTE} ».`);
  if (dupCount > 0) stats.warnings.push(`${dupCount} doublon(s) de dossier détecté(s) (conservés).`);
  if (stats.totalRowSkipped > 0) stats.warnings.push(`${stats.totalRowSkipped} ligne(s) de total exclue(s).`);
  return stats;
}
