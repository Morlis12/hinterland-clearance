import { normalizeHeader, CATEGORIES } from "./constants";

export type FileKind = "A" | "B" | "unknown";

export interface DetectedColumns {
  agence: number;
  uniteCom: number;
  com: number;
  dossier: number;
  dossiersValides: number; // -1 si absent (Fichier B)
  categories: Record<string, number>; // key -> col index (1-based)
  headerRow: number;
  dataStartRow: number;
}

/** Repère les colonnes par texte d'en-tête (jamais par position fixe). */
export function locateDetailColumns(
  headerValues: (unknown)[],
  opts: { requireDossiersValides: boolean }
): { cols: DetectedColumns | null; missing: string[] } {
  // headerValues indexé 0..n (col = idx+1)
  const norm = headerValues.map(normalizeHeader);
  const find = (needle: string): number => {
    const idx = norm.findIndex((h) => h === needle || h.startsWith(needle));
    return idx >= 0 ? idx + 1 : -1;
  };
  const agence = find("agence");
  const uniteCom = find("unite com");
  const com = find("com");
  const dossier = find("dossier");
  let dossiersValides = norm.findIndex(
    (h) => h.includes("dossiers valides") || h.includes("files validated")
  );
  dossiersValides = dossiersValides >= 0 ? dossiersValides + 1 : -1;

  const categories: Record<string, number> = {};
  const missing: string[] = [];
  if (agence < 0) missing.push("Agence");
  if (uniteCom < 0) missing.push("Unité COM");
  if (com < 0) missing.push("COM");
  if (dossier < 0) missing.push("Dossier");
  if (opts.requireDossiersValides && dossiersValides < 0)
    missing.push("Dossiers Validés sur 12 Mois");
  for (const c of CATEGORIES) {
    const idx = norm.findIndex((h) => h === c.fr || h.startsWith(c.fr));
    if (idx < 0) missing.push(c.fr);
    else categories[c.key] = idx + 1;
  }
  if (missing.length > 0) return { cols: null, missing };
  return {
    cols: {
      agence,
      uniteCom,
      com,
      dossier,
      dossiersValides,
      categories,
      headerRow: 1,
      dataStartRow: 3,
    },
    missing: [],
  };
}

export function detectFileKind(sheetNames: string[], firstHeaders: string[]): FileKind {
  const names = sheetNames.map((s) => s.toLowerCase());
  const hasSheet1Sheet2 =
    names.includes("sheet1") && names.includes("sheet2");
  if (hasSheet1Sheet2) return "A";
  if (names.includes("feuil1") && sheetNames.length === 1) return "B";
  // Repli : si les en-têtes contiennent "dossiers valides" => A, sinon B
  const norm = firstHeaders.map(normalizeHeader).join(" | ");
  if (norm.includes("dossiers valides")) return "A";
  return "unknown";
}
