"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { KpiCard, SnapshotSelector, Legend, FilterBar } from "@/components/ui";
import { appendFilters, emptyFilters, type Filters } from "@/src/lib/filters";

const CATS: { key: string; label: string }[] = [
  { key: "bae", label: "BAE" },
  { key: "factDouane", label: "Fact. Douane" },
  { key: "miseEnLivraison", label: "Mise en livraison" },
  { key: "livraison", label: "Livraison" },
  { key: "retourConteneur", label: "Retour conteneur" },
  { key: "declaresNonFactures", label: "Déclarés non facturés" },
  { key: "factPrestation", label: "Fact. prestation" },
  { key: "archivage", label: "Archivage" },
  { key: "sansDeclaration", label: "Sans déclaration" },
  { key: "debours", label: "Avec débours" },
];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [options, setOptions] = useState<{ agences: string[]; unites: string[]; coms: string[] }>({ agences: [], unites: [], coms: [] });

  const load = async (f: Filters, id?: number | null) => {
    setError("");
    const qs = new URLSearchParams();
    const useId = id === undefined ? snapshot : id;
    if (useId) qs.set("snapshot", String(useId));
    appendFilters(qs, f);
    qs.set("limit", "200");
    const r = await fetch(`/api/dashboard?${qs}`);
    const j = await r.json();
    if (!r.ok) setError(j.error ?? "Erreur de chargement.");
    else {
      setData(j);
      setSnapshot(j.importId);
      if (j.options) setOptions(j.options);
    }
  };

  useEffect(() => { load(emptyFilters(), null); }, []);

  const onFilter = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (patch.q !== undefined && Object.keys(patch).length === 1) return; // saisie : debounce
    load(next);
  };

  const firstQ = useRef(true);
  useEffect(() => {
    if (firstQ.current) { firstQ.current = false; return; }
    const t = setTimeout(() => load(filters), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  if (error) return <div className="rounded bg-white p-6 text-red-600 dark:bg-slate-900 dark:text-red-400">{error} <Link className="underline" href="/import">Aller à l&apos;import.</Link></div>;
  if (!data) return <div className="rounded bg-white p-6 dark:bg-slate-900">Chargement…</div>;

  const k = data.kpis;
  const prevKpis = data.evolution?.previous as Record<string, number> | undefined;
  const prevOf = (key: string, fallbackKey?: string): number | undefined =>
    prevKpis ? Number(prevKpis[key] ?? (fallbackKey ? prevKpis[fallbackKey] : undefined) ?? 0) : undefined;
  const catData = CATS.map((c) => ({ name: c.label, value: Number(k[c.key] ?? 0), key: c.key }));
  const top = (showAll ? data.top : data.top.slice(0, 15));
  const comData = top.map((t: any) => ({ name: String(t.com).slice(0, 24), total: t.total, com: t.com }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-marine-900 dark:text-white">Tableau de bord</h1>
        <SnapshotSelector snapshots={data.snapshots} value={snapshot} onChange={(id) => load(filters, id)} />
      </div>
      <FilterBar
        agences={options.agences}
        unites={options.unites}
        coms={options.coms}
        fAgence={filters.agence}
        fUnite={filters.unite}
        fCom={filters.com}
        fCategorie={filters.categorie}
        fQ={filters.q}
        onChange={onFilter}
      />
      <Legend />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard label="Total dossiers en retard (distincts)" value={k.totalAvecRetard ?? k.total} href={`/details?snapshot=${snapshot}`} accent="border-red-600" previousValue={prevOf("totalAvecRetard", "total")} />
        {CATS.slice(0, 9).map((c) => (
          <KpiCard key={c.key} label={c.label} value={k[c.key] ?? 0} href={`/details?snapshot=${snapshot}&categorie=${c.key}`} previousValue={prevOf(c.key)} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
          <h2 className="mb-2 font-semibold">Retards par catégorie</h2>
          <div className="chart-cat" style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={catData} layout="vertical" margin={{ left: 90 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#162f7d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Cliquez sur une carte KPI pour filtrer le détail. La somme des catégories ≠ dossiers distincts.</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Retards par COM (top {showAll ? data.top.length : 15})</h2>
            <button onClick={() => setShowAll(!showAll)} className="text-xs text-marine-700 underline dark:text-gold-300">
              {showAll ? "Voir top 15" : "Voir tout"}
            </button>
          </div>
          <div className="chart-com" style={{ height: 320, overflowY: showAll ? "auto" : "hidden" }}>
            <ResponsiveContainer width="100%" height={showAll ? Math.max(320, comData.length * 28) : 320}>
              <BarChart data={comData} layout="vertical" margin={{ left: 90 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#b91c1c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Link href="/coms" className="text-xs text-marine-700 underline dark:text-gold-300">Ouvrir l&apos;analyse par COM →</Link>
        </div>
      </div>

      {data.evolution && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
          <h2 className="mb-2 font-semibold">Mini-évolution (2 dernières extractions)</h2>
          <MiniEvolution previous={data.evolution.previous} recent={data.evolution.recent} />
        </div>
      )}
    </div>
  );
}

function MiniEvolution({ previous, recent }: { previous: any; recent: any }) {
  const rows = [
    { label: "Total", p: previous.totalAvecRetard ?? previous.total, r: recent.totalAvecRetard ?? recent.total },
    { label: "Archivage", p: previous.archivage, r: recent.archivage },
    { label: "Avec débours", p: previous.debours, r: recent.debours },
    { label: "Fact. prestation", p: previous.factPrestation, r: recent.factPrestation },
  ];
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-slate-500 dark:text-slate-400"><th>Indicateur</th><th>N-1</th><th>N</th><th>Variation</th><th>Variation %</th></tr></thead>
      <tbody>
        {rows.map((x) => {
          const v = x.r - x.p;
          const pct = x.p > 0 ? (100 * v) / x.p : null;
          const cls = v > 0 ? "text-red-600 dark:text-red-400" : v < 0 ? "text-green-700 dark:text-green-400" : "text-slate-500 dark:text-slate-400";
          return (
            <tr key={x.label} className="border-t dark:border-slate-800">
              <td>{x.label}</td><td>{x.p}</td><td>{x.r}</td>
              <td className={cls}>{v > 0 ? `+${v}` : v}</td>
              <td className={cls}>{pct === null ? "—" : `${pct.toFixed(1)} %`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
