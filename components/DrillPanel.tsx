"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import Drawer from "@/components/Drawer";
import { HelpBubble } from "@/components/Help";
import { formatDateFR, formatDateTimeFR } from "@/components/ui";
import { CATEGORIES } from "@/src/lib/import/constants";

export type DrillTarget = { kind: "total" | "category" | "com"; key: string; label: string };
export type TrendRow = { id: number; file_name: string; extraction_date: string; loaded_at: string; total: number; totalAvecRetard: number } & Record<string, any>;

const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

function valueOf(row: Record<string, any> | undefined, t: DrillTarget): number {
  if (!row) return 0;
  return Number(t.kind === "category" ? row[t.key] : row.totalAvecRetard ?? row.total ?? 0);
}

export default function DrillPanel({
  target, snapshotId, top, trends, onClose, onDrill, onSelectSnapshot, detailsQuery,
}: {
  target: DrillTarget | null;
  snapshotId: number | null;
  top: any[];
  trends: TrendRow[];
  onClose: () => void;
  onDrill: (t: DrillTarget) => void;
  onSelectSnapshot: (id: number) => void;
  detailsQuery: string;
}) {
  const [comTrends, setComTrends] = useState<TrendRow[] | null>(null);
  useEffect(() => {
    setComTrends(null);
    if (target?.kind !== "com") return;
    let live = true;
    fetch(`/api/trends?com=${encodeURIComponent(target.key)}`).then((r) => r.json()).then((j) => live && setComTrends(j.snapshots ?? []));
    return () => { live = false; };
  }, [target?.kind, target?.key]);

  const series = useMemo(() => (target?.kind === "com" ? comTrends ?? [] : trends), [target?.kind, comTrends, trends]);
  const idx = series.findIndex((s) => s.id === snapshotId);
  const cur = idx >= 0 ? series[idx] : series[series.length - 1];
  const prev = idx > 0 ? series[idx - 1] : undefined;

  const points = useMemo(
    () => (target ? series.map((s) => ({ id: s.id, date: formatDateFR(s.extraction_date), loaded: formatDateTimeFR(s.loaded_at), file: s.file_name, value: valueOf(s, target) })) : []),
    [series, target]
  );

  const topRows = useMemo(() => {
    if (!target || target.kind === "com") return [];
    return top
      .map((t) => ({ name: String(t.com), value: Number(target.kind === "category" ? t[target.key] : t.total) || 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [top, target]);

  const byCat = useMemo(() => {
    if (target?.kind !== "com") return [];
    const row = top.find((t) => String(t.com) === target.key);
    if (!row) return [];
    return CATEGORIES.map((c) => ({ key: c.key, name: c.label, value: Number(row[c.key]) || 0 })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  }, [top, target]);

  if (!target) return null;

  const value = valueOf(cur, target);
  const diff = prev ? value - valueOf(prev, target) : null;
  const pct = prev && valueOf(prev, target) > 0 ? (100 * (diff as number)) / valueOf(prev, target) : null;
  const cls = diff === null ? "text-slate-500" : diff > 0 ? "text-red-600" : diff < 0 ? "text-green-700" : "text-slate-500";
  const scope =
    target.kind === "com" ? `les dossiers du COM « ${target.label} »` : target.kind === "category" ? `les dossiers marqués « ${target.label} »` : "les dossiers distincts présents dans au moins une catégorie";
  const steps = [
    `On compte ${scope} dans l'extraction SPOT du ${cur ? formatDateFR(cur.extraction_date) : "—"} (fichier chargé le ${cur ? formatDateTimeFR(cur.loaded_at) : "—"}).`,
    "Les filtres actifs du tableau de bord (agence, unité, COM, recherche) restreignent ce comptage.",
    prev ? `La variation compare avec l'extraction du ${formatDateFR(prev.extraction_date)}.` : "Il n'y a pas d'extraction précédente : aucune variation n'est calculée.",
  ];
  const qs = new URLSearchParams(detailsQuery);
  if (snapshotId) qs.set("snapshot", String(snapshotId));
  if (target.kind === "category") qs.set("categorie", target.key);
  if (target.kind === "com") qs.set("com", target.key);

  return (
    <Drawer open onClose={onClose} title={target.label}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">{target.kind === "com" ? "Dossiers en retard du COM" : "Dossiers en retard"} · {cur ? formatDateFR(cur.extraction_date) : "—"}</div>
          <div className="text-4xl font-extrabold text-marine-900 dark:text-white" data-testid="drill-value">{value.toLocaleString("fr-FR")}</div>
        </div>
        <div className={`text-sm font-semibold ${cls}`}>
          {diff === null ? "Pas de comparaison" : `${diff > 0 ? "▲" : diff < 0 ? "▼" : "▬"} ${diff > 0 ? "+" : ""}${diff.toLocaleString("fr-FR")}${pct !== null ? ` (${pct > 0 ? "+" : ""}${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %)` : ""}`}
          {prev && <div className="text-xs font-normal text-slate-500">vs {formatDateFR(prev.extraction_date)}</div>}
        </div>
      </div>

      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gold-500">Comment ce chiffre est obtenu</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </section>

      <section>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">Évolution dans le temps <HelpBubble id="trend" /></div>
        {points.length < 2 ? (
          <div className="rounded bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Une seule extraction chargée : importez une autre extraction pour voir l&apos;évolution.</div>
        ) : (
          <div className="chart-trend" style={{ height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={points} margin={{ left: 0, right: 12, top: 8 }} onClick={(e: any) => { const id = e?.activePayload?.[0]?.payload?.id; if (id) onSelectSnapshot(id); }} style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={44} />
                <Tooltip content={<TrendTip />} />
                <Line type="monotone" dataKey="value" stroke="#b91c1c" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="text-xs text-slate-500">Cliquez sur un point pour afficher cette extraction dans le tableau de bord.</div>
      </section>

      {target.kind === "com" ? (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Répartition par catégorie</h3>
          {byCat.length === 0 ? <div className="text-sm text-slate-500">Détail indisponible pour ce COM dans la vue courante.</div> : (
            <div className="chart-cat" style={{ height: Math.max(120, byCat.length * 30) }}>
              <ResponsiveContainer>
                <BarChart data={byCat} layout="vertical" margin={{ left: 70 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" cursor="pointer" onClick={(d: any) => d?.key && onDrill({ kind: "category", key: d.key, label: d.name })} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      ) : (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Les 10 COM les plus concernés</h3>
          {topRows.length === 0 ? <div className="text-sm text-slate-500">Aucun COM concerné avec les filtres actifs.</div> : (
            <div className="chart-com" style={{ height: Math.max(140, topRows.length * 30) }}>
              <ResponsiveContainer>
                <BarChart data={topRows} layout="vertical" margin={{ left: 70 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
                  <Tooltip />
                  <Bar dataKey="value" cursor="pointer" onClick={(d: any) => d?.name && onDrill({ kind: "com", key: d.name, label: d.name })} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="text-xs text-slate-500">Cliquez sur un COM pour ouvrir sa fiche.</div>
        </section>
      )}

      <div className="rounded border-l-4 border-gold-300 bg-gold-100/60 p-3 text-sm dark:bg-slate-800">
        <strong>Étape utile :</strong>{" "}
        {target.kind === "com"
          ? "ouvrez la liste de ses dossiers, traitez d'abord la catégorie la plus chargée, puis comparez avec l'extraction suivante."
          : "repérez les COM en tête, ouvrez la liste des dossiers concernés et transmettez-la aux responsables."}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/details?${qs}`} className="rounded bg-marine-800 px-3 py-1.5 text-sm text-white hover:bg-marine-700 dark:bg-gold-300 dark:text-marine-900">Voir les dossiers</Link>
        <Link href="/evolution" className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Comparer deux extractions</Link>
      </div>
    </Drawer>
  );
}

function TrendTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded border border-slate-200 bg-white p-2 text-xs shadow dark:border-slate-700 dark:bg-slate-900">
      <div className="font-semibold">Extraction du {p.date}</div>
      <div>{Number(p.value).toLocaleString("fr-FR")} dossier(s)</div>
      <div className="text-slate-500">Chargé le {p.loaded}</div>
      <div className="text-slate-500">{p.file}</div>
    </div>
  );
}
