// En-têtes français de référence (normalisés : minuscules, sans accents, espaces simples)
export const HEADERS = {
  agence: "agence",
  uniteCom: "unite com",
  com: "com",
  dossier: "dossier",
  dossiersValides: "dossiers valides sur 12 mois",
} as const;

// 10 catégories dans l'ordre canonique (bit 0..9)
export const CATEGORIES = [
  { key: "bae", fr: "bae en retard", bit: 0, label: "BAE" },
  { key: "factDouane", fr: "facturation douane en retard", bit: 1, label: "Facturation Douane" },
  { key: "miseEnLivraison", fr: "mise en livraison en retard", bit: 2, label: "Mise en livraison" },
  { key: "livraison", fr: "livraison en retard", bit: 3, label: "Livraison" },
  { key: "retourConteneur", fr: "retour conteneur en retard", bit: 4, label: "Retour conteneur" },
  { key: "declaresNonFactures", fr: "dossiers declares non factures", bit: 5, label: "Déclarés non facturés" },
  { key: "factPrestation", fr: "facturation prestation en retard", bit: 6, label: "Facturation prestation" },
  // Changement côté source (2026-10-29) : la colonne s'appelait « Archivage en Retard »,
  // elle s'appelle maintenant « Dossiers non Archivés » (Sheet1 et Sheet2 du Fichier A).
  // normalizeHeader() gère déjà les espaces multiples / la casse / les accents : aucune
  // autre adaptation n'est nécessaire pour que la correspondance reste valide.
  { key: "archivage", fr: "dossiers non archives", bit: 7, label: "Archivage" },
  { key: "sansDeclaration", fr: "dossiers sans declaration", bit: 8, label: "Sans déclaration" },
  { key: "debours", fr: "dossiers avec debours", bit: 9, label: "Avec débours" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const SEUILS_INFO = [
  "Air : 5 jours",
  "Maritime & Route Local : 10 jours",
  "Maritime Hinterland : 15 jours",
];

export function normalizeHeader(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function flagToInt(v: unknown): 0 | 1 {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v === 0 ? 0 : 1;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).trim();
  if (s === "" || s === "0") return 0;
  return 1;
}

export function maskFromFlags(flags: Record<string, number>): number {
  let mask = 0;
  for (const c of CATEGORIES) {
    if ((flags[c.key] ?? 0) === 1) mask |= 1 << c.bit;
  }
  return mask;
}

export const NON_AFFECTE = "Non affecté";
