"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatDateFR, InfoBanner, FilterBar } from "@/components/ui";

const CATS: { key: string; label: string; color: string }[] = [
  { key: "total", label: "Total", color: "#6366f1" },
  { key: "bae", label: "BAE", color: "#ef4444" },
  { key: "factDouane", label: "Douane", color: "#f97316" },
  { key: "miseEnLivraison", label: "Mise livr.", color: "#eab308" },
  { key: "livraison", label: "Livraison", color: "#84cc16" },
  { key: "retourConteneur", label: "Retour", color: "#10b981" },
  { key: "declaresNonFactures", label: "Décl. non fact.", color: "#06b6d4" },
  { key: "factPrestation", label: "Fact. prest.", color: "#3b82f6" },
  { key: "archivage", label: "Archivage", color: "#8b5cf6" },
  { key: "sansDeclaration", label: "Sans décl.", color: "#ec4899" },
  { key: "debours", label: "Débours", color: "#14b8a6" },
];

function varCls(v: number): string {
  return v > 0
    ? "text-red-600 font-semibold dark:text-red-400"
    : v < 0
      ? "text-green-700 font-semibold dark:text-green-400"
      : "text-slate-500 dark:text-slate-400";
}
function arrowOf(v: number): string {
  return v > 0 ? "▲" : v < 0 ? "▼" : "▬";
}
function diffStr(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR")}`;
}
function pctStr(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct > 0 ? "+" : ""}${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
}

type ComSortKey = "com" | "ancien" | "recent" | "variation" | "pct";

type Filters = { agence: string; com: string; categorie: string; q: string };
const NO_FILTERS: Filters = { agence: "", com: "", categorie: "", q: "" };

function appendFilters(qs: URLSearchParams, f: Filters) {
  if (f.agence) qs.set("agence", f.agence);
  if (f.com) qs.set("com", f.com);
  if (f.categorie) qs.set("categorie", f.categorie);
  if (f.q) qs.set("q", f.q);
}

export default function EvolutionPage() {
  const [data, setData] = useState<any>(null);
  const [n, setN] = useState("");
  const [n1, setN1] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [options, setOptions] = useState<{ agences: string[]; coms: string[] }>({ agences: [], coms: [] });
  const [comSort, setComSort] = useState<{ key: ComSortKey; dir: "asc" | "desc" }>({ key: "variation", dir: "desc" });

  const load = async (a?: string, b?: string, f: Filters = filters) => {
    setError("");
    const qs = new URLSearchParams();
    if (a && b) { qs.set("n1", a); qs.set("n", b); }
    else if (n1 && n) { qs.set("n1", n1); qs.set("n", n); }
    appendFilters(qs, f);
    const r = await fetch(`/api/evolution?${qs}`);
    const j = await r.json();
    if (!r.ok) setError(j.error ?? "Erreur.");
    else {
      setData(j);
      if (j.recentSnap) setN(String(j.recentSnap.id));
      if (j.previousSnap) setN1(String(j.previousSnap.id));
      if (j.options) setOptions(j.options);
    }
  };

  useEffect(() => { load(); }, []);

  const onFilter = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (patch.q !== undefined && Object.keys(patch).length === 1) return; // saisie : debounce
    load(undefined, undefined, next);
  };

  const firstQ = useRef(true);
  useEffect(() => {
    if (firstQ.current) { firstQ.current = false; return; }
    const t = setTimeout(() => load(undefined, undefined), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  const trendParams = useMemo(() => {
    const qs = new URLSearchParams();
    appendFilters(qs, filters);
    return qs.toString();
  }, [filters]);

  const comRows = useMemo(() => {
    if (!data?.parCom) return [];
    const rows = data.parCom.map((r: any) => {
      const ancien = Number(r.ancien ?? 0);
      const recent = Number(r.recent ?? 0);
      const variation = recent - ancien;
      return { com: r.com, ancien, recent, variation, pct: ancien > 0 ? (100 * variation) / ancien : null };
    });
    const dir = comSort.dir === "asc" ? 1 : -1;
    rows.sort((a: any, b: any) => {
      if (comSort.key === "com") return dir * String(a.com ?? "").localeCompare(String(b.com ?? ""), "fr");
      const va = a[comSort.key];
      const vb = b[comSort.key];
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return dir * (va - vb);
    });
    return rows;
  }, [data, comSort]);

  if (error) return <div className="rounded bg-white p-6 text-red-600 dark:bg-slate-900 dark:text-red-400">{error}</div>;
  if (!data) return <div className="rounded bg-white p-6 dark:bg-slate-900">Chargement…</div>;
  if (data.single) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marine-900 dark:text-white">Évolution</h1>
      <div className="rounded bg-white p-6 text-slate-600 dark:bg-slate-900 dark:text-slate-400">{data.message}</div>
    </div>
  );

  const rows = CATS.map((c) => {
    const a = Number(data.ancien[c.key] ?? 0);
    const b = Number(data.recent[c.key] ?? 0);
    const v = b - a;
    const pct = a ? (100 * v) / a : null;
    return { ...c, ancien: a, recent: b, variation: v, pct };
  });

  const totA = Number(data.ancien.totalAvecRetard ?? data.ancien.total ?? 0);
  const totB = Number(data.recent.totalAvecRetard ?? data.recent.total ?? 0);
  const dTot = totB - totA;
  const pctTot = totA > 0 ? (100 * dTot) / totA : null;

  const Th = ({ k, children, right }: { k: ComSortKey; children: ReactNode; right?: boolean }) => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      onClick={() =>
        setComSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "com" ? "asc" : "desc" }))
      }
    >
      {children}
      {comSort.key === k ? (comSort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marine-900 dark:text-white">Évolution</h1>
      <div className="flex flex-wrap gap-3 text-sm">
        <label>Extraction précédente (N-1) : <select value={n1} onChange={(e) => { setN1(e.target.value); load(e.target.value, n); }} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {data.snapshots.map((s: any) => <option key={s.id} value={s.id}>{formatDateFR(s.extraction_date)} — {s.file_name}</option>)}
        </select></label>
        <label>Extraction actuelle (N) : <select value={n} onChange={(e) => { setN(e.target.value); load(n1, e.target.value); }} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {data.snapshots.map((s: any) => <option key={s.id} value={s.id}>{formatDateFR(s.extraction_date)} — {s.file_name}</option>)}
        </select></label>
      </div>

      <FilterBar
        agences={options.agences}
        coms={options.coms}
        fAgence={filters.agence}
        fCom={filters.com}
        fCategorie={filters.categorie}
        fQ={filters.q}
        onChange={onFilter}
      />

      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Total dossiers en retard (distincts)</div>
          <div className="text-2xl font-extrabold text-marine-900 dark:text-white">
            {totA.toLocaleString("fr-FR")} <span className="text-slate-400">→</span> {totB.toLocaleString("fr-FR")}
          </div>
        </div>
        <div className={`text-lg font-bold ${varCls(dTot)}`}>
          {arrowOf(dTot)} {diffStr(dTot)} {pctTot !== null && <span className="text-base font-semibold">({pctStr(pctTot)})</span>}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Extraction du {formatDateFR(data.previousSnap?.extraction_date)} (N-1) au {formatDateFR(data.recentSnap?.extraction_date)} (N)
        </div>
      </div>

      <InfoBanner title="Lecture des couleurs" storageKey="hinterland-evolution-colors">
        Rouge = dégradation (retards en hausse), vert = amélioration (en baisse), gris = stable.
      </InfoBanner>

      <div className="rounded-lg bg-white p-4 shadow-sm overflow-x-auto dark:bg-slate-900 dark:shadow-none">
        <h2 className="mb-2 font-semibold">Par catégorie</h2>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-slate-500 dark:text-slate-400"><th>Catégorie</th><th>N-1</th><th>N</th><th>Variation</th><th>Variation %</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t dark:border-slate-800">
                <td>{r.label}</td><td>{r.ancien.toLocaleString("fr-FR")}</td><td>{r.recent.toLocaleString("fr-FR")}</td>
                <td className={varCls(r.variation)}>{arrowOf(r.variation)} {diffStr(r.variation)}</td>
                <td className={varCls(r.variation)}>{pctStr(r.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
        <h2 className="mb-2 font-semibold">Par COM</h2>
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="text-slate-500 dark:text-slate-400">
                <Th k="com">COM</Th><Th k="ancien" right>N-1</Th><Th k="recent" right>N</Th>
                <Th k="variation" right>Variation</Th><Th k="pct" right>Variation %</Th>
              </tr>
            </thead>
            <tbody>
              {comRows.map((r: any, i: number) => (
                <tr key={i} className="border-t dark:border-slate-800">
                  <td>{r.com}</td>
                  <td className="text-right">{r.ancien.toLocaleString("fr-FR")}</td>
                  <td className="text-right">{r.recent.toLocaleString("fr-FR")}</td>
                  <td className={`text-right ${varCls(r.variation)}`}>{arrowOf(r.variation)} {diffStr(r.variation)}</td>
                  <td className={`text-right ${varCls(r.variation)}`}>{pctStr(r.pct)}</td>
                </tr>
              ))}
              {comRows.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400">Aucune donnée.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
        <h2 className="mb-2 font-semibold">Tendance (tous snapshots)</h2>
        <TrendChart snapshots={data.snapshots} params={trendParams} />
      </div>
    </div>
  );
}

function TrendChart({ snapshots, params }: { snapshots: any[]; params: string }) {
  const [series, setSeries] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<string[]>(["total"]);
  useEffect(() => {
    (async () => {
      const out: any[] = [];
      for (const s of [...snapshots].reverse()) {
        const r = await fetch(`/api/dashboard?snapshot=${s.id}${params ? `&${params}` : ""}`).then((x) => x.json());
        const k = r.kpis ?? {};
        const row: any = {
          date: formatDateFR(s.extraction_date),
          total: Number(k.totalAvecRetard ?? k.total ?? 0),
        };
        for (const c of CATS.slice(1)) row[c.key] = Number(k[c.key] ?? 0);
        out.push(row);
      }
      setSeries(out);
    })();
  }, [snapshots, params]);

  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const active = CATS.filter((c) => selected.includes(c.key));

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {CATS.map((c) => {
          const on = selected.includes(c.key);
          return (
            <button
              key={c.key}
              onClick={() => toggle(c.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on
                  ? "border-slate-400 bg-slate-100 font-semibold dark:border-slate-500 dark:bg-slate-800"
                  : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
              }`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="chart-trend" style={{ height: 300 }}>
        {series === null ? (
          <div className="p-4 text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={series}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              {active.map((c) => (
                <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={2} dot={{ r: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cliquez sur une catégorie ci-dessus pour l&apos;afficher ou la masquer.</p>
    </div>
  );
}
