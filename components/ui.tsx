"use client";
import { useEffect, useState, type ReactNode } from "react";
import { CATEGORIES } from "@/src/lib/import/constants";

/** Date AAAA-MM-JJ -> jj/mm/aaaa (jamais d'ISO brut à l'écran). */
export function formatDateFR(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? "");
}

export function KpiCard({
  label, value, href, accent, previousValue,
}: {
  label: string;
  value: number | string;
  href?: string;
  accent?: string;
  previousValue?: number;
}) {
  const cur = Number(value);
  const noPrev = previousValue === undefined;
  const diff = noPrev ? 0 : cur - (previousValue as number);
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "▬";
  const cls = noPrev
    ? "text-slate-400 dark:text-slate-500"
    : diff > 0
      ? "text-red-600 dark:text-red-400"
      : diff < 0
        ? "text-green-700 dark:text-green-400"
        : "text-slate-500 dark:text-slate-400";
  const diffStr = `${diff > 0 ? "+" : ""}${diff.toLocaleString("fr-FR")}`;
  const pct = !noPrev && (previousValue as number) > 0 ? (100 * diff) / (previousValue as number) : null;
  const pctStr = pct === null ? null : `${pct > 0 ? "+" : ""}${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

  const inner = (
    <div className={`flex h-full flex-col rounded-lg bg-white p-4 shadow-sm border-l-4 dark:bg-slate-900 dark:shadow-none ${accent ?? "border-marine-800 dark:border-gold-300"}`}>
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</div>
      <div className="my-1 text-2xl font-extrabold text-marine-900 dark:text-white">{cur.toLocaleString("fr-FR")}</div>
      <div className={`mt-auto text-xs font-semibold ${cls}`} title="Variation vs extraction précédente">
        {noPrev ? "Pas de comparaison" : `${arrow} ${diffStr}${pctStr ? ` (${pctStr})` : ""}`}
      </div>
    </div>
  );
  if (href) return <a href={href} className="block h-full hover:shadow-md transition-shadow">{inner}</a>;
  return inner;
}

export function SnapshotSelector({
  snapshots, value, onChange,
}: { snapshots: { id: number; extraction_date: string; file_name: string }[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-600 dark:text-slate-400">Extraction :</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {snapshots.map((s) => (
          <option key={s.id} value={s.id}>
            {formatDateFR(s.extraction_date)} — {s.file_name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InfoBanner({
  title, storageKey, children, defaultOpen = true,
}: { title: string; storageKey: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v !== null) setOpen(v === "1");
    } catch {}
  }, [storageKey]);
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
      return next;
    });
  };
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-400"
      >
        <strong className="dark:text-slate-200">{title}</strong>
        <span className="shrink-0 underline">{open ? "Réduire" : "Afficher"}</span>
      </button>
      {open && <div className="px-3 pb-3 text-xs text-slate-700 dark:text-slate-400">{children}</div>}
    </div>
  );
}

export function FilterBar({
  agences, unites, coms, fAgence, fUnite, fCom, fCategorie, fQ, onChange,
}: {
  agences: string[];
  unites: string[];
  coms: string[];
  fAgence: string;
  fUnite: string;
  fCom: string;
  fCategorie: string;
  fQ: string;
  onChange: (patch: { agence?: string; unite?: string; com?: string; categorie?: string; q?: string }) => void;
}) {
  const sel = "rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const active = fAgence || fUnite || fCom || fCategorie || fQ;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-slate-900 dark:shadow-none">
      <label className="inline-flex items-center gap-2">
        <span className="text-slate-600 dark:text-slate-400">Agence :</span>
        <select value={fAgence} onChange={(e) => onChange({ agence: e.target.value })} className={sel}>
          <option value="">Toutes</option>
          {agences.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="inline-flex items-center gap-2">
        <span className="text-slate-600 dark:text-slate-400">Unité :</span>
        <select value={fUnite} onChange={(e) => onChange({ unite: e.target.value })} className={sel}>
          <option value="">Toutes</option>
          {unites.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </label>
      <label className="inline-flex items-center gap-2">
        <span className="text-slate-600 dark:text-slate-400">COM :</span>
        <select value={fCom} onChange={(e) => onChange({ com: e.target.value })} className={sel}>
          <option value="">Tous</option>
          {coms.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="inline-flex items-center gap-2">
        <span className="text-slate-600 dark:text-slate-400">Catégorie :</span>
        <select value={fCategorie} onChange={(e) => onChange({ categorie: e.target.value })} className={sel}>
          <option value="">Toutes</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </label>
      <input
        value={fQ}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder="Nom / n° de dossier…"
        className={`${sel} w-52`}
      />
      {active && (
        <button
          onClick={() => onChange({ agence: "", unite: "", com: "", categorie: "", q: "" })}
          className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}

export function Legend() {
  return (
    <InfoBanner title="Seuils SPOT (informatifs, déjà appliqués)" storageKey="hinterland-legend-open">
      Air : 5 jours · Maritime & Route locale : 10 jours · Maritime Hinterland : 15 jours. L&apos;application n&apos;invente aucune règle métier et ne recalcule pas les retards.
      Un dossier peut apparaître dans plusieurs catégories : la somme des catégories n&apos;est jamais un nombre de dossiers distincts.
    </InfoBanner>
  );
}
