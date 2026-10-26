"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MultiSelect, formatDateFR, formatDateTimeFR } from "@/components/ui";
import SnapshotBanner from "@/components/SnapshotBanner";
import PageHeader from "@/components/PageHeader";

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
  const [snapMeta, setSnapMeta] = useState<{ id: number; extraction_date: string; loaded_at: string }[]>([]);
  useEffect(() => { fetch("/api/snapshots").then((r) => r.json()).then((j) => setSnapMeta(j.snapshots ?? [])).catch(() => {}); }, []);

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

  const snap = snapMeta.find((s) => s.id === (data?.importId ?? Number(params.get("snapshot"))));
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Overdue / Dossiers" title="Détail des dossiers" subtitle="Liste des dossiers en retard, filtrable, avec les dates d'extraction et de chargement de chaque ligne." />
      <SnapshotBanner snapshotId={data?.importId ?? (params.get("snapshot") ? Number(params.get("snapshot")) : null)} />
      <div className="flex flex-wrap gap-2 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche dossier ou COM…" className="rounded-lg border border-line bg-panel px-2 py-1 w-64" />
        <input value={com} onChange={(e) => setCom(e.target.value)} placeholder="COM exact…" className="rounded-lg border border-line bg-panel px-2 py-1" />
        <MultiSelect
          label="Catégorie"
          options={CATS.filter((c) => c.key).map((c) => ({ value: c.key, label: c.label }))}
          values={categories}
          onChange={setCategories}
          allLabel="Toutes"
        />
        <button onClick={() => load(1)} className="rounded bg-marine-800 px-3 py-1 text-white dark:bg-gold-300 dark:text-marine-900 dark:hover:bg-gold-400">Filtrer</button>
        {(q || com || categories.length > 0) && <span className="text-xs text-mut self-center">Filtres actifs depuis le tableau de bord via l&apos;URL.</span>}
      </div>
      {error && <div className="rounded-2xl border border-line bg-panel p-4 text-sm text-bad">{error}</div>}
      {data && (
        <>
          <div className="text-sm text-mut">{data.total.toLocaleString("fr-FR")} dossier(s) — page {data.page}/{data.pages}</div>
          <div className="overflow-x-auto rounded-2xl border border-line bg-panel shadow-sm">
            <table className="min-w-full text-xs">
              <thead><tr className="bg-th text-th-ink">
                {["Extraction", "Chargé le", "Dossier", "Agence", "Unité", "COM", "BAE", "Douane", "Mise livr.", "Livraison", "Retour", "Décl.n.fact", "Fact.prest.", "Archiv.", "Sans décl.", "Débours"].map((h) => <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {data.rows.map((r: any, i: number) => (
                  <tr key={i} className="border-t hover:bg-hl">
                    <td className="px-2 py-1 whitespace-nowrap text-mut">{snap ? formatDateFR(snap.extraction_date) : ""}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-mut">{snap ? formatDateTimeFR(snap.loaded_at) : ""}</td>
                    <td className="px-2 py-1 font-mono">{r.dossier}</td>
                    <td className="px-2 py-1">{r.agence}</td>
                    <td className="px-2 py-1">{r.unite}</td>
                    <td className="px-2 py-1">{r.com}</td>
                    {[r.bae, r.factDouane, r.miseEnLivraison, r.livraison, r.retourConteneur, r.declaresNonFactures, r.factPrestation, r.archivage, r.sansDeclaration, r.debours].map((v: number, k: number) => (
                      <td key={k} className={`px-2 py-1 text-center ${v ? "bg-bad-bg font-bold text-bad" : "text-mut "}`}>{v ? "1" : "·"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 text-sm">
            <button disabled={page <= 1} onClick={() => load(page - 1)} className="rounded border border-line px-3 py-1 disabled:opacity-40">← Précédent</button>
            <button disabled={page >= data.pages} onClick={() => load(page + 1)} className="rounded border border-line px-3 py-1 disabled:opacity-40">Suivant →</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function DetailsPage() {
  return <Suspense fallback={<div>Chargement…</div>}><DetailsInner /></Suspense>;
}
