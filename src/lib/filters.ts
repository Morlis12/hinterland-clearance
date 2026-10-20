export type Filters = {
  agence: string[];
  unite: string[];
  com: string[];
  categorie: string[];
  q: string;
};

export function emptyFilters(): Filters {
  return { agence: [], unite: [], com: [], categorie: [], q: "" };
}

/** Lit un filtre multi-valeurs (paramètres répétés) et déduplique les valeurs. */
export function parseMulti(params: URLSearchParams, key: string): string[] | undefined {
  const values = params.getAll(key).map((v) => v.trim()).filter(Boolean);
  if (values.length === 0) return undefined;
  return [...new Set(values)];
}

/** Ajoute les filtres à la query string, avec un paramètre par valeur sélectionnée. */
export function appendFilters(qs: URLSearchParams, f: Filters): void {
  for (const key of ["agence", "unite", "com", "categorie"] as const) {
    for (const value of f[key]) qs.append(key, value);
  }
  if (f.q) qs.set("q", f.q);
}

export function hasFilters(f: Filters): boolean {
  return Boolean(f.agence.length || f.unite.length || f.com.length || f.categorie.length || f.q);
}
