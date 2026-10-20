"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MultiSelect } from "@/components/ui";

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

const norm = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function ComsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [agences, setAgences] = useState<string[]>([]);
  const [unites, setUnites] = useState<string[]>([]);
  const [fAgence, setFAgence] = useState<string[]>([]);
  const [fUnite, setFUnite] = useState<string[]>([]);
  const [fCom, setFCom] = useState<string[]>([]);
  const [fNom, setFNom] = useState("");
  const [dossierQ, setDossierQ] = useState("");
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

  const coms = useMemo(
    () => [...new Set(rows.map((x) => x.com).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "fr")) as string[],
    [rows]
  );

  const filtered = useMemo(() => {
    let out = rows.filter(
      (x) =>
        (!fAgence.length || fAgence.includes(x.agence)) &&
        (!fUnite.length || fUnite.includes(x.uniteCom)) &&
        (!fCom.length || fCom.includes(x.com)) &&
        (!fNom || norm(x.com).includes(norm(fNom)) || norm(x.uniteCom).includes(norm(fNom)))
    );
    out = [...out].sort((a, b) => {
      const va = a[sort] ?? 0, vb = b[sort] ?? 0;
      if (typeof va === "string") return dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      return dir === "asc" ? va - vb : vb - va;
    });
    return out;
  }, [rows, fAgence, fUnite, fCom, fNom, sort, dir]);

  const totals = useMemo(() => filtered.map((x) => Number(x.total) || 0), [filtered]);
  const minTotal = Math.min(...totals, 0);
  const maxTotal = Math.max(...totals, 1);
  const heat = (t: number) => {
    const ratio = maxTotal === minTotal ? 0.5 : (t - minTotal) / (maxTotal - minTotal);
    const lerp = (a: number, b: number, x: number) => Math.round(a + (b - a) * x);
    const red = [220, 38, 38], orange = [234, 88, 12], green = [22, 163, 74];
    const [r, g, b] =
      ratio >= 0.5
        ? [lerp(orange[0], red[0], (ratio - 0.5) * 2), lerp(orange[1], red[1], (ratio - 0.5) * 2), lerp(orange[2], red[2], (ratio - 0.5) * 2)]
        : [lerp(green[0], orange[0], ratio * 2), lerp(green[1], orange[1], ratio * 2), lerp(green[2], orange[2], ratio * 2)];
    return `rgba(${r}, ${g}, ${b}, ${(0.18 + 0.32 * ratio).toFixed(3)})`;
  };

  const toggleSort = (key: string) => {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(key); setDir("desc"); }
  };

  if (error) return <div className="rounded bg-white p-6 text-red-600 dark:bg-slate-900 dark:text-red-400">{error}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marine-900 dark:text-white">Analyse par COM</h1>
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-slate-900 dark:shadow-none">
        <MultiSelect label="Agence" options={agences.map((a) => ({ value: a, label: a }))} values={fAgence} onChange={setFAgence} allLabel="Toutes" />
        <MultiSelect label="Unité" options={unites.map((a) => ({ value: a, label: a }))} values={fUnite} onChange={setFUnite} allLabel="Toutes" />
        <MultiSelect label="COM" options={coms.map((a) => ({ value: a, label: a }))} values={fCom} onChange={setFCom} allLabel="Tous" />
        <input value={fNom} onChange={(e) => setFNom(e.target.value)} placeholder="Nom (COM / unité)…" className="w-52 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        {(fAgence.length > 0 || fUnite.length > 0 || fCom.length > 0 || fNom) && (
          <button onClick={() => { setFAgence([]); setFUnite([]); setFCom([]); setFNom(""); }} className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Réinitialiser</button>
        )}
        <span className="text-xs text-slate-500 dark:text-slate-400">{filtered.length} COM affichés. Taux = retards / dossiers validés 12 mois (si disponible). Colonne Total : rouge (plus critique) → orange → vert (moins critique) selon le nombre de retards.</span>
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
                    style={{ backgroundColor: heat(t) }}
                    title={`${t} retard(s) — échelle calculée sur les COM affichés (rouge = plus critique, vert = moins critique)`}
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
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm dark:border-slate-800">
            <input
              value={dossierQ}
              onChange={(e) => setDossierQ(e.target.value)}
              placeholder="N° de dossier (recherche dans ses détails)…"
              className="w-72 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <Link
              className="rounded bg-marine-800 px-3 py-1 text-white dark:bg-gold-300 dark:text-marine-900"
              href={`/details?com=${encodeURIComponent(selected.com)}${dossierQ ? `&q=${encodeURIComponent(dossierQ)}` : ""}`}
            >
              Rechercher
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
