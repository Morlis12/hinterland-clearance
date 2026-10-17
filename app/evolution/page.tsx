"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const CATS = [
  { key: "total", label: "Total" },
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
];

export default function EvolutionPage() {
  const [data, setData] = useState<any>(null);
  const [n, setN] = useState("");
  const [n1, setN1] = useState("");
  const [error, setError] = useState("");

  const load = async (a?: string, b?: string) => {
    setError("");
    const qs = new URLSearchParams();
    if (a && b) { qs.set("n1", a); qs.set("n", b); }
    else if (n1 && n) { qs.set("n1", n1); qs.set("n", n); }
    const r = await fetch(`/api/evolution?${qs}`);
    const j = await r.json();
    if (!r.ok) setError(j.error ?? "Erreur.");
    else {
      setData(j);
      if (j.recentSnap) setN(String(j.recentSnap.id));
      if (j.previousSnap) setN1(String(j.previousSnap.id));
    }
  };

  useEffect(() => { load(); }, []);

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
    const pct = a ? (100 * v / a) : null;
    return { ...c, ancien: a, recent: b, variation: v, pct };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marine-900 dark:text-white">Évolution</h1>
      <div className="flex flex-wrap gap-3 text-sm">
        <label>N-1 : <select value={n1} onChange={(e) => setN1(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {data.snapshots.map((s: any) => <option key={s.id} value={s.id}>{s.extraction_date} — {s.file_name}</option>)}
        </select></label>
        <label>N : <select value={n} onChange={(e) => setN(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {data.snapshots.map((s: any) => <option key={s.id} value={s.id}>{s.extraction_date} — {s.file_name}</option>)}
        </select></label>
        <button onClick={() => load(n1, n)} className="rounded bg-marine-800 px-3 py-1 text-white dark:bg-gold-300 dark:text-marine-900 dark:hover:bg-gold-400">Comparer</button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Rouge = dégradation (retards en hausse), vert = amélioration (en baisse), gris = stable. L&apos;orange n&apos;est qu&apos;un repère visuel pour les faibles variations.
      </p>

      <div className="rounded-lg bg-white p-4 shadow-sm overflow-x-auto dark:bg-slate-900 dark:shadow-none">
        <h2 className="mb-2 font-semibold">Par catégorie</h2>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-slate-500 dark:text-slate-400"><th>Catégorie</th><th>N-1</th><th>N</th><th>Variation</th><th>Variation %</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const cls = r.variation > 0 ? "text-red-600 font-semibold dark:text-red-400" : r.variation < 0 ? "text-green-700 font-semibold dark:text-green-400" : "text-slate-500 dark:text-slate-400";
              const warn = Math.abs(r.variation) > 0 && r.ancien > 0 && Math.abs(r.variation / r.ancien) < 0.03;
              return (
                <tr key={r.key} className="border-t dark:border-slate-800">
                  <td>{r.label}</td><td>{r.ancien.toLocaleString("fr-FR")}</td><td>{r.recent.toLocaleString("fr-FR")}</td>
                  <td className={warn ? "text-orange-500 font-semibold" : cls}>{r.variation > 0 ? `+${r.variation}` : r.variation}</td>
                  <td className={warn ? "text-orange-500" : cls}>{r.pct === null ? "—" : `${r.pct.toFixed(1)} %`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm overflow-x-auto dark:bg-slate-900 dark:shadow-none">
        <h2 className="mb-2 font-semibold">Par COM</h2>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-slate-500 dark:text-slate-400"><th>COM</th><th>N-1</th><th>N</th><th>Variation</th><th>Variation %</th></tr></thead>
          <tbody>
            {data.parCom.slice(0, 100).map((r: any, i: number) => {
              const cls = r.variation > 0 ? "text-red-600 dark:text-red-400" : r.variation < 0 ? "text-green-700 dark:text-green-400" : "text-slate-400";
              const pct = r.ancien > 0 ? (100 * r.variation) / r.ancien : null;
              return (
                <tr key={i} className="border-t dark:border-slate-800">
                  <td>{r.com}</td><td>{r.ancien}</td><td>{r.recent}</td>
                  <td className={cls}>{r.variation > 0 ? `+${r.variation}` : r.variation}</td>
                  <td className={cls}>{pct === null ? "—" : `${pct.toFixed(1)} %`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
        <h2 className="mb-2 font-semibold">Tendance (tous snapshots)</h2>
        <TrendChart snapshots={data.snapshots} />
      </div>
    </div>
  );
}

function TrendChart({ snapshots }: { snapshots: any[] }) {
  const [series, setSeries] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const out = [];
      for (const s of [...snapshots].reverse()) {
        const r = await fetch(`/api/dashboard?snapshot=${s.id}`).then((x) => x.json());
        out.push({ date: s.extraction_date, total: r.kpis?.totalAvecRetard ?? r.kpis?.total ?? 0 });
      }
      setSeries(out);
    })();
  }, [snapshots]);
  return (
    <div className="chart-trend" style={{ height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="total" stroke="#162f7d" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
