"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MultiSelect } from "@/components/ui";
import SnapshotBanner from "@/components/SnapshotBanner";
import PageHeader from "@/components/PageHeader";

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

  if (error) return <div className="rounded-2xl border border-line bg-panel p-6 text-bad">{error}</div>;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Overdue / Analyse" title="Analyse par COM" subtitle="Charge de retard de chaque COM, par agence et par unité." />
      <SnapshotBanner />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-3 text-sm shadow-sm">
        <MultiSelect label="Agence" options={agences.map((a) => ({ value: a, label: a }))} values={fAgence} onChange={setFAgence} allLabel="Toutes" />
        <MultiSelect label="Unité" options={unites.map((a) => ({ value: a, label: a }))} values={fUnite} onChange={setFUnite} allLabel="Toutes" />
        <MultiSelect label="COM" options={coms.map((a) => ({ value: a, label: a }))} values={fCom} onChange={setFCom} allLabel="Tous" />
        <input value={fNom} onChange={(e) => setFNom(e.target.value)} placeholder="Nom (COM / unité)…" className="w-52 rounded-lg border border-line bg-panel px-2 py-1" />
        {(fAgence.length > 0 || fUnite.length > 0 || fCom.length > 0 || fNom) && (
          <button onClick={() => { setFAgence([]); setFUnite([]); setFCom([]); setFNom(""); }} className="rounded border border-line px-3 py-1 text-xs hover:bg-panel2">Réinitialiser</button>
        )}
        <span className="text-xs text-mut">{filtered.length} COM affichés. Taux = retards / dossiers validés 12 mois (si disponible). Colonne Total : rouge (plus critique) → orange → vert (moins critique) selon le nombre de retards.</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-panel shadow-sm">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-th text-th-ink">
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
                <tr key={i} className="border-t hover:bg-hl cursor-pointer" onClick={() => setSelected(x)}>
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
        <div className="rounded-2xl border border-line bg-panel p-4 shadow-sm">
          <h2 className="font-semibold">COM : {selected.com} ({selected.uniteCom} — {selected.agence})</h2>
          <p className="text-sm text-mut">
            Dossiers validés 12 mois : {selected.dossiersValides ?? "donnée indisponible"} ·
            Total retards : {selected.total}
            {selected.dossiersValides ? ` · Taux : ${(100 * selected.total / selected.dossiersValides).toFixed(1)} %` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            <input
              value={dossierQ}
              onChange={(e) => setDossierQ(e.target.value)}
              placeholder="N° de dossier (recherche dans ses détails)…"
              className="w-72 rounded-lg border border-line bg-panel px-2 py-1"
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
