import * as XLSX from "xlsx";
import { createHash } from "node:crypto";
import {
  CATEGORIES,
  NON_AFFECTE,
  flagToInt,
  maskFromFlags,
  normalizeHeader,
} from "./constants";
import { locateDetailColumns, type FileKind } from "./detect";

export interface SummaryRow {
  agence: string;
  uniteCom: string;
  com: string;
  isSubtotal: boolean;
  dossiersValides: number | null;
  flags: Record<string, number>;
}

export interface DetailRow {
  agence: string;
  uniteCom: string;
  com: string;
  dossier: string;
  flags: Record<string, number>;
  mask: number;
}

export interface ParsedFileA {
  kind: "A";
  sha256: string;
  fileName: string;
  extractionDate: string; // AAAA-MM-JJ
  summaryRows: SummaryRow[];
  subtotalRows: SummaryRow[];
  detailRows: DetailRow[];
  rulesInfo: string[];
  warnings: string[];
  errors: string[];
  preview: DetailRow[];
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\s/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toInt0(v: unknown): number {
  const n = toIntOrNull(v);
  return n === null ? 0 : n;
}

function excelDateToISO(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const base = Date.UTC(1899, 11, 30);
    const d = new Date(base + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

type Grid = unknown[][]; // lignes 0-based, colonnes 0-based

function sheetToGrid(sheet: XLSX.WorkSheet): Grid {
  // header:1 => tableau de tableaux ; defval:null remplit les fusions esclaves par null
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
}

function gridCell(grid: Grid, row1: number, col1: number): unknown {
  // row1/col1 en 1-based (style Excel)
  const r = grid[row1 - 1];
  if (!r) return null;
  return r[col1 - 1] ?? null;
}

/** Lit le Fichier A complet depuis un buffer (petit volume, lecture DOM via SheetJS). */
export async function parseFileA(buffer: Buffer, fileName: string): Promise<ParsedFileA> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetNames: string[] = wb.SheetNames;

  const s1 = wb.Sheets["Sheet1"];
  const s2 = wb.Sheets["Sheet2"];
  if (!s1 || !s2) {
    errors.push(
      `Feuilles attendues "Sheet1" et "Sheet2" introuvables (feuilles vues : ${sheetNames.join(", ")}). ` +
        `Si votre fichier ne contient que "Feuil1", il s'agit du Fichier B : utilisez le script CLI (npm run import).`
    );
    return {
      kind: "A", sha256, fileName, extractionDate: "",
      summaryRows: [], subtotalRows: [], detailRows: [], rulesInfo: [],
      warnings, errors, preview: [],
    };
  }
  const g1 = sheetToGrid(s1);
  const g2 = sheetToGrid(s2);

  // ---------- Sheet1 : date d'extraction (haut de feuille, lignes 1-5) ----------
  let extractionDate = "";
  outer: for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 30; c++) {
      const iso = excelDateToISO(gridCell(g1, r, c));
      if (iso) { extractionDate = iso; break outer; }
    }
  }
  if (!extractionDate) {
    errors.push("Date d'extraction introuvable dans le haut de Sheet1 (attendue vers la ligne 3).");
  }

  // ---------- Sheet1 : en-têtes FR ligne 6, repérage par texte ----------
  const headerRow6: unknown[] = [];
  for (let c = 1; c <= 30; c++) headerRow6.push(gridCell(g1, 6, c));
  const norm6 = headerRow6.map(normalizeHeader);
  const colOf = (needle: string): number => {
    const i = norm6.findIndex((h) => h === needle || h.startsWith(needle));
    return i >= 0 ? i + 1 : -1;
  };
  const cAgence = colOf("agence");
  const cUnite = colOf("unite com");
  const cCom = colOf("com");
  const cValidesIdx = norm6.findIndex((h) => h.includes("dossiers valides"));
  const cValidesCol = cValidesIdx >= 0 ? cValidesIdx + 1 : -1;
  const catCols: Record<string, number> = {};
  const missingCols: string[] = [];
  if (cAgence < 0) missingCols.push("Agence");
  if (cUnite < 0) missingCols.push("Unité COM");
  if (cCom < 0) missingCols.push("COM");
  if (cValidesCol < 0) missingCols.push("Dossiers Validés sur 12 Mois");
  for (const c of CATEGORIES) {
    const i = norm6.findIndex((h) => h === c.fr || h.startsWith(c.fr));
    if (i < 0) missingCols.push(c.fr);
    else catCols[c.key] = i + 1;
  }
  if (missingCols.length > 0) {
    errors.push(`Sheet1 : colonnes introuvables (ligne 6) : ${missingCols.join(", ")}.`);
  }

  const summaryRows: SummaryRow[] = [];
  const subtotalRows: SummaryRow[] = [];
  const rulesInfo: string[] = [];

  if (missingCols.length === 0) {
    // Données à partir de la ligne 8.
    // NOTE : avec SheetJS, les cellules fusionnées esclaves valent null : nos colonnes
    // détectées sont toujours des têtes de fusion, donc lisibles directement.
    for (let r = 8; r <= g1.length; r++) {
      const agence = cellStr(gridCell(g1, r, cAgence));
      const unite = cellStr(gridCell(g1, r, cUnite));
      const com = cellStr(gridCell(g1, r, cCom));
      const validesRaw = gridCell(g1, r, cValidesCol);

      const flagsProbe: Record<string, number> = {};
      let anyFlag = false;
      for (const c of CATEGORIES) {
        const n = toInt0(gridCell(g1, r, catCols[c.key]));
        flagsProbe[c.key] = n;
        if (n !== 0) anyFlag = true;
      }
      const valides = toIntOrNull(validesRaw);

      // Ligne vide totale => ignorer (le bloc règles est plus bas, on continue)
      if (!agence && !unite && !com && valides === null && !anyFlag) {
        let lineText = "";
        for (let c = 1; c <= 15; c++) lineText += " " + cellStr(gridCell(g1, r, c));
        if (/d[eé]lais|seuil|jour/i.test(lineText)) {
          const cleaned = lineText.replace(/\s+/g, " ").trim();
          if (cleaned.length > 5) rulesInfo.push(cleaned.slice(0, 300));
        }
        continue;
      }
      // Bloc de règles : sans agence ET sans chiffres => jamais un COM
      // (même si du texte traîne dans les colonnes Unité/COM, ex. "10 jours…").
      if (!agence && valides === null && !anyFlag) {
        let lineText = "";
        for (let c = 1; c <= 15; c++) lineText += " " + cellStr(gridCell(g1, r, c));
        const cleaned = lineText.replace(/\s+/g, " ").trim();
        if (/d[eé]lais|seuil|jour|days|delay/i.test(lineText)) {
          if (cleaned.length > 5 && !rulesInfo.includes(cleaned.slice(0, 300)))
            rulesInfo.push(cleaned.slice(0, 300));
        }
        continue;
      }

      const isSubtotal = !unite; // pas d'Unité COM => sous-total agence ou total général
      const sr: SummaryRow = {
        agence, uniteCom: unite, com,
        isSubtotal,
        dossiersValides: valides,
        flags: flagsProbe,
      };
      if (isSubtotal) subtotalRows.push(sr);
      else summaryRows.push(sr);
    }
  }

  // ---------- Sheet2 : détail (en-têtes FR ligne 1, données dès ligne 3) ----------
  const h1: unknown[] = [];
  const maxCol2 = Math.max(g2[0]?.length ?? 15, 15);
  for (let c = 1; c <= maxCol2; c++) h1.push(gridCell(g2, 1, c));
  const { cols, missing } = locateDetailColumns(h1, { requireDossiersValides: false });
  if (!cols) {
    errors.push(`Sheet2 : colonnes obligatoires manquantes (ligne 1) : ${missing.join(", ")}.`);
    return {
      kind: "A", sha256, fileName, extractionDate,
      summaryRows, subtotalRows, detailRows: [], rulesInfo, warnings, errors, preview: [],
    };
  }

  const detailRows: DetailRow[] = [];
  const seenDossiers = new Map<string, number>();
  let rowsWithoutCom = 0;
  let totalRowSkipped = 0;

  for (let r = 3; r <= g2.length; r++) {
    const agence = cellStr(gridCell(g2, r, cols.agence));
    const unite = cellStr(gridCell(g2, r, cols.uniteCom));
    const com = cellStr(gridCell(g2, r, cols.com));
    const dossier = cellStr(gridCell(g2, r, cols.dossier));

    if (!dossier && !agence && !unite && !com) {
      // La ligne de total en bas a un dossier vide MAIS des totaux dans les
      // colonnes catégories : la compter comme total exclu.
      let hasNumbers = false;
      for (const c of CATEGORIES) {
        const v = gridCell(g2, r, cols.categories[c.key]);
        if (v !== null && v !== undefined && String(v).trim() !== "") { hasNumbers = true; break; }
      }
      if (hasNumbers) totalRowSkipped++;
      continue;
    }
    if (!dossier) {
      warnings.push(`Sheet2 ligne ${r} : numéro de dossier vide — ligne ignorée.`);
      continue;
    }
    // Ligne de total résiduelle : pas d'agence ni COM.
    if (!agence && !unite && !com) {
      totalRowSkipped++;
      continue;
    }

    const flags: Record<string, number> = {};
    for (const c of CATEGORIES) {
      flags[c.key] = flagToInt(gridCell(g2, r, cols.categories[c.key]));
    }
    const finalCom = com || NON_AFFECTE;
    const finalUnite = unite || "";
    if (!com && !unite) rowsWithoutCom++;

    const prev = seenDossiers.get(dossier) ?? 0;
    seenDossiers.set(dossier, prev + 1);

    detailRows.push({
      agence,
      uniteCom: finalUnite,
      com: finalCom,
      dossier,
      flags,
      mask: maskFromFlags(flags),
    });
  }

  // Doublons : signaler sans supprimer
  const dups = [...seenDossiers.entries()].filter(([, n]) => n > 1);
  if (dups.length > 0) {
    warnings.push(
      `${dups.length} numéro(s) de dossier en doublon (conservés) : ${dups.slice(0, 10).map(([d, n]) => `${d}×${n}`).join(", ")}${dups.length > 10 ? "…" : ""}.`
    );
  }
  if (rowsWithoutCom > 0) {
    warnings.push(
      `${rowsWithoutCom} ligne(s) sans Unité COM ni COM regroupées sous « ${NON_AFFECTE} ».`
    );
  }
  if (totalRowSkipped > 0) {
    warnings.push(
      `${totalRowSkipped} ligne(s) de total en bas de Sheet2 exclue(s) des dossiers.`
    );
  }

  return {
    kind: "A",
    sha256,
    fileName,
    extractionDate,
    summaryRows,
    subtotalRows,
    detailRows,
    rulesInfo,
    warnings,
    errors,
    preview: detailRows.slice(0, 8),
  };
}

export type { FileKind };
