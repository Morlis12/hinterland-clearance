"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MultiSelect } from "@/components/ui";

const CATS = [
  { key: "", label: "Toutes catégories" },
  { key: "bae", label: "BAE" },
  { key: "factDouane", label: "Facturation Douane" },
  { key: "miseEnLivraison", label: "Mise en livraison" },
  { key: "livraison", label: "Livraison" },
  { key: "retourConteneur", label: "Retour conteneur" },
  { key: "declaresNonFactures", label: "Déclarés non facturés" },
  { key: "factPrestation", label: "Facturation prestation" },
  { key: "archivage", label: "Archivage" },
  { key: "sansDeclaration", label: "Sans déclaration" },
  { key: "debours", label: "Avec débours" },
];

function DetailsInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [com, setCom] = useState(params.get("com") ?? "");
  const [categories, setCategories] = useState<string[]>(() => params.getAll("categorie").filter(Boolean));
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const load = useCallback(async (p = 1) => {
    setError("");
    const qs = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (q) qs.set("q", q);
    if (com) qs.set("com", com);
    for (const value of categories) qs.append("categorie", value);
    const snap = params.get("snapshot");
    if (snap) qs.set("snapshot", snap);
    const r = await fetch(`/api/dossiers?${qs}`);
    const j = await r.json();
    if (!r.ok) setError(j.error ?? "Erreur.");
    else { setData(j); setPage(j.page); }
  }, [q, com, categories, params]);

  useEffect(() => { load(1); }, [categories, params]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marine-900 dark:text-white">Détail des dossiers</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche dossier ou COM…" className="rounded border border-slate-300 bg-white px-2 py-1 w-64 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        <input value={com} onChange={(e) => setCom(e.target.value)} placeholder="COM exact…" className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        <MultiSelect
          label="Catégorie"
          options={CATS.filter((c) => c.key).map((c) => ({ value: c.key, label: c.label }))}
          values={categories}
          onChange={setCategories}
          allLabel="Toutes"
        />
        <button onClick={() => load(1)} className="rounded bg-marine-800 px-3 py-1 text-white dark:bg-gold-300 dark:text-marine-900 dark:hover:bg-gold-400">Filtrer</button>
        {(q || com || categories.length > 0) && <span className="text-xs text-slate-500 self-center dark:text-slate-400">Filtres actifs depuis le tableau de bord via l&apos;URL.</span>}
      </div>
      {error && <div className="rounded bg-white p-4 text-sm text-red-600 dark:bg-slate-900 dark:text-red-400">{error}</div>}
      {data && (
        <>
          <div className="text-sm text-slate-600 dark:text-slate-400">{data.total.toLocaleString("fr-FR")} dossier(s) — page {data.page}/{data.pages}</div>
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm dark:bg-slate-900 dark:shadow-none">
            <table className="min-w-full text-xs">
              <thead><tr className="bg-marine-900 text-white dark:bg-slate-800">
                {["Dossier", "Agence", "Unité", "COM", "BAE", "Douane", "Mise livr.", "Livraison", "Retour", "Décl.n.fact", "Fact.prest.", "Archiv.", "Sans décl.", "Débours"].map((h) => <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {data.rows.map((r: any, i: number) => (
                  <tr key={i} className="border-t hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800">
                    <td className="px-2 py-1 font-mono">{r.dossier}</td>
                    <td className="px-2 py-1">{r.agence}</td>
                    <td className="px-2 py-1">{r.unite}</td>
                    <td className="px-2 py-1">{r.com}</td>
                    {[r.bae, r.factDouane, r.miseEnLivraison, r.livraison, r.retourConteneur, r.declaresNonFactures, r.factPrestation, r.archivage, r.sansDeclaration, r.debours].map((v: number, k: number) => (
                      <td key={k} className={`px-2 py-1 text-center ${v ? "bg-red-50 font-bold text-red-700 dark:bg-red-950 dark:text-red-400" : "text-slate-300 dark:text-slate-600"}`}>{v ? "1" : "·"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 text-sm">
            <button disabled={page <= 1} onClick={() => load(page - 1)} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-700">← Précédent</button>
            <button disabled={page >= data.pages} onClick={() => load(page + 1)} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-700">Suivant →</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function DetailsPage() {
  return <Suspense fallback={<div>Chargement…</div>}><DetailsInner /></Suspense>;
}
