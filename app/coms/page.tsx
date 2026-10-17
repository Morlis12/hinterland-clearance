"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const COLS: { key: string; label: string }[] = [
  { key: "com", label: "COM" },
  { key: "uniteCom", label: "Unité COM" },
  { key: "dossiersValides", label: "Validés 12 mois" },
  { key: "bae", label: "BAE" },
  { key: "factDouane", label: "Douane" },
  { key: "miseEnLivraison", label: "Mise livr." },
  { key: "livraison", label: "Livraison" },
  { key: "retourConteneur", label: "Retour" },
  { key: "declaresNonFactures", label: "Décl. non fact." },
  { key: "factPrestation", label: "Fact. prest." },
  { key: "archivage", label: "Archivage" },
  { key: "sansDeclaration", label: "Sans décl." },
  { key: "debours", label: "Débours" },
  { key: "total", label: "Total retards" },
];

export default function ComsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [agences, setAgences] = useState<string[]>([]);
  const [unites, setUnites] = useState<string[]>([]);
  const [fAgence, setFAgence] = useState("");
  const [fUnite, setFUnite] = useState("");
  const [sort, setSort] = useState("total");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/coms").then(async (r) => {
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Erreur.");
      else { setRows(j.rows); setAgences(j.agences); setUnites(j.unites); }
    });
  }, []);

  const filtered = useMemo(() => {
    let out = rows.filter((x) => (!fAgence || x.agence === fAgence) && (!fUnite || x.uniteCom === fUnite));
    out = [...out].sort((a, b) => {
      const va = a[sort] ?? 0, vb = b[sort] ?? 0;
      if (typeof va === "string") return dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      return dir === "asc" ? va - vb : vb - va;
    });
    return out;
  }, [rows, fAgence, fUnite, sort, dir]);

  const maxTotal = useMemo(() => Math.max(1, ...filtered.map((x) => Number(x.total) || 0)), [filtered]);

  const toggleSort = (key: string) => {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(key); setDir("desc"); }
  };

  if (error) return <div className="rounded bg-white p-6 text-red-600 dark:bg-slate-900 dark:text-red-400">{error}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marine-900 dark:text-white">Analyse par COM</h1>
      <div className="flex flex-wrap gap-3 text-sm">
        <label>Agence : <select value={fAgence} onChange={(e) => setFAgence(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><option value="">Toutes</option>{agences.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        <label>Unité : <select value={fUnite} onChange={(e) => setFUnite(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><option value="">Toutes</option>{unites.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        <span className="text-slate-500 dark:text-slate-400">{filtered.length} COM affichés. Taux = retards / dossiers validés 12 mois (si disponible). Colonne Total : rouge d&apos;autant plus intense que les retards sont nombreux.</span>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm dark:bg-slate-900 dark:shadow-none">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-marine-900 text-white dark:bg-slate-800">
              {COLS.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)} className="cursor-pointer whitespace-nowrap px-2 py-2 text-left hover:underline">
                  {c.label}{sort === c.key ? (dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((x, i) => {
              const t = Number(x.total) || 0;
              const ratio = maxTotal > 0 ? t / maxTotal : 0;
              return (
                <tr key={i} className="border-t hover:bg-blue-50 cursor-pointer dark:border-slate-800 dark:hover:bg-slate-800" onClick={() => setSelected(x)}>
                  <td className="px-2 py-1 font-medium">{x.com}</td>
                  <td className="px-2 py-1">{x.uniteCom}</td>
                  <td className="px-2 py-1 text-right">{x.dossiersValides ?? "—"}</td>
                  <td className="px-2 py-1 text-right">{x.bae}</td>
                  <td className="px-2 py-1 text-right">{x.factDouane}</td>
                  <td className="px-2 py-1 text-right">{x.miseEnLivraison}</td>
                  <td className="px-2 py-1 text-right">{x.livraison}</td>
                  <td className="px-2 py-1 text-right">{x.retourConteneur}</td>
                  <td className="px-2 py-1 text-right">{x.declaresNonFactures}</td>
                  <td className="px-2 py-1 text-right">{x.factPrestation}</td>
                  <td className="px-2 py-1 text-right">{x.archivage}</td>
                  <td className="px-2 py-1 text-right">{x.sansDeclaration}</td>
                  <td className="px-2 py-1 text-right">{x.debours}</td>
                  <td
                    className="px-2 py-1 text-right font-bold"
                    style={{ backgroundColor: `rgba(185, 28, 28, ${(0.06 + 0.5 * ratio).toFixed(3)})` }}
                    title={`${t} retard(s) — ${(100 * ratio).toFixed(0)} % du plus fort total affiché`}
                  >
                    {x.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
          <h2 className="font-semibold">COM : {selected.com} ({selected.uniteCom} — {selected.agence})</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dossiers validés 12 mois : {selected.dossiersValides ?? "donnée indisponible"} ·
            Total retards : {selected.total}
            {selected.dossiersValides ? ` · Taux : ${(100 * selected.total / selected.dossiersValides).toFixed(1)} %` : ""}
          </p>
          <Link className="text-sm text-marine-700 underline dark:text-gold-300" href={`/details?com=${encodeURIComponent(selected.com)}`}>
            Voir ses dossiers →
          </Link>
        </div>
      )}
    </div>
  );
}
