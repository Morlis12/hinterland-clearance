"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CATEGORIES } from "@/src/lib/import/constants";

/** Date AAAA-MM-JJ -> jj/mm/aaaa (jamais d'ISO brut à l'écran). */
export function formatDateFR(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? "");
}

/** Horodatage ISO -> jj/mm/aaaa à hh:mm (heure de Côte d'Ivoire = UTC). */
export function formatDateTimeFR(iso: string | Date | null | undefined): string {
  const d = iso instanceof Date ? iso : new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return String(iso ?? "");
  const date = d.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  return `${date} à ${time}`;
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 110, h = 26, lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => [4 + (i / (values.length - 1)) * (w - 8), h - 4 - ((v - lo) / span) * (h - 9)]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="mt-1">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="text-marine-700 dark:text-gold-300" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" className="fill-gold-500" />
    </svg>
  );
}

export function KpiCard({
  label, value, href, accent, previousValue, onOpen, spark, help, dateLabel,
}: {
  label: string;
  value: number | string;
  href?: string;
  accent?: string;
  previousValue?: number;
  onOpen?: () => void;
  spark?: number[];
  help?: ReactNode;
  dateLabel?: string;
}) {
  const cur = Number(value);
  const noPrev = previousValue === undefined;
  const diff = noPrev ? 0 : cur - (previousValue as number);
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "▬";
  const cls = noPrev
    ? "text-mut "
    : diff > 0
      ? "text-bad"
      : diff < 0
        ? "text-ok"
        : "text-mut";
  const diffStr = `${diff > 0 ? "+" : ""}${diff.toLocaleString("fr-FR")}`;
  const pct = !noPrev && (previousValue as number) > 0 ? (100 * diff) / (previousValue as number) : null;
  const pctStr = pct === null ? null : `${pct > 0 ? "+" : ""}${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

  const inner = (
    <div className={`flex h-full flex-col rounded-2xl border border-line border-l-4 bg-panel p-4 shadow-sm ${accent ?? "border-l-acc"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-mut">{label}</div>
        {help}
      </div>
      <div className="my-1 text-2xl font-extrabold text-titre">{cur.toLocaleString("fr-FR")}</div>
      {spark && <Spark values={spark} />}
      <div className={`mt-auto pt-1 text-xs font-semibold ${cls}`} title="Variation vs extraction précédente">
        {noPrev ? "Pas de comparaison" : `${arrow} ${diffStr}${pctStr ? ` (${pctStr})` : ""}`}
      </div>
      {(dateLabel || onOpen) && (
        <div className="flex items-center justify-between gap-2 text-[10px] text-mut">
          <span>{dateLabel}</span>
          {onOpen && <span className="font-semibold text-gold-500">Voir le détail ›</span>}
        </div>
      )}
    </div>
  );
  if (onOpen) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        className="block h-full cursor-pointer rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        {inner}
      </div>
    );
  }
  if (href) return <a href={href} className="block h-full hover:shadow-md transition-shadow">{inner}</a>;
  return inner;
}

export function SnapshotSelector({
  snapshots, value, onChange,
}: { snapshots: { id: number; extraction_date: string; loaded_at?: string; file_name: string }[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-mut">Extraction du :</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-line bg-panel px-2 py-1"
      >
        {snapshots.map((s) => (
          <option key={s.id} value={s.id}>
            {formatDateFR(s.extraction_date)}{s.loaded_at ? ` · chargé le ${formatDateFR(s.loaded_at)}` : ""} — {s.file_name}
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
    <div className="rounded-lg border border-blue-100 bg-hl">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs text-mut"
      >
        <strong className="">{title}</strong>
        <span className="shrink-0 underline">{open ? "Réduire" : "Afficher"}</span>
      </button>
      {open && <div className="px-3 pb-3 text-xs text-mut">{children}</div>}
    </div>
  );
}

export type MultiOption = { value: string; label: string };

export function MultiSelect({
  label, options, values, onChange, allLabel = "Tous", className = "",
}: {
  label: string;
  options: MultiOption[];
  values: string[];
  onChange: (values: string[]) => void;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = new Set(values);
  const labels = values.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const summary =
    values.length === 0 ? allLabel : values.length === 1 ? (labels[0] ?? values[0]) : `${values.length} sélectionnés`;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const toggle = (value: string) => {
    onChange(selected.has(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center gap-2 ${className}`}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
    >
      <span className="text-mut">{label} :</span>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        title={values.length ? labels.join(", ") : allLabel}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-w-36 max-w-56 items-center justify-between gap-2 rounded-lg border border-line bg-panel px-2 py-1 text-left"
      >
        <span className={`truncate ${values.length ? "" : "text-mut"}`}>{summary}</span>
        <span aria-hidden className="shrink-0 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-panel p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-line pb-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-mut underline hover:text-titre"
            >
              Tout effacer
            </button>
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="text-xs text-mut underline hover:text-titre"
            >
              Tout sélectionner
            </button>
          </div>
          <div className="max-h-64 overflow-auto">
            {options.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-panel2"
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={() => toggle(o.value)}
                  className="accent-marine-800"
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
            {options.length === 0 && <div className="px-2 py-1 text-xs text-mut">Aucune option</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  agences, unites, coms, fAgence, fUnite, fCom, fCategorie, fQ, onChange,
}: {
  agences: string[];
  unites: string[];
  coms: string[];
  fAgence: string[];
  fUnite: string[];
  fCom: string[];
  fCategorie: string[];
  fQ: string;
  onChange: (patch: { agence?: string[]; unite?: string[]; com?: string[]; categorie?: string[]; q?: string }) => void;
}) {
  const sel = "rounded-lg border border-line bg-panel px-2 py-1   ";
  const active = fAgence.length > 0 || fUnite.length > 0 || fCom.length > 0 || fCategorie.length > 0 || Boolean(fQ);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-3 text-sm shadow-sm">
      <MultiSelect
        label="Agence"
        options={agences.map((a) => ({ value: a, label: a }))}
        values={fAgence}
        onChange={(values) => onChange({ agence: values })}
        allLabel="Toutes"
      />
      <MultiSelect
        label="Unité"
        options={unites.map((u) => ({ value: u, label: u }))}
        values={fUnite}
        onChange={(values) => onChange({ unite: values })}
        allLabel="Toutes"
      />
      <MultiSelect
        label="COM"
        options={coms.map((c) => ({ value: c, label: c }))}
        values={fCom}
        onChange={(values) => onChange({ com: values })}
        allLabel="Tous"
      />
      <MultiSelect
        label="Catégorie"
        options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
        values={fCategorie}
        onChange={(values) => onChange({ categorie: values })}
        allLabel="Toutes"
      />
      <input
        value={fQ}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder="Nom / n° de dossier…"
        className={`${sel} w-52`}
      />
      {active && (
        <button
          onClick={() => onChange({ agence: [], unite: [], com: [], categorie: [], q: "" })}
          className="rounded border border-line px-3 py-1 text-xs hover:bg-panel2"
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
