"use client";

export function KpiCard({ label, value, href, accent, delta }: { label: string; value: number | string; href?: string; accent?: string; delta?: number | null }) {
  const inner = (
    <div className={`rounded-lg bg-white p-4 shadow-sm border-l-4 dark:bg-slate-900 dark:shadow-none ${accent ?? "border-marine-800 dark:border-gold-300"}`}>
      <div className="text-2xl font-extrabold text-marine-900 dark:text-white">{Number(value).toLocaleString("fr-FR")}</div>
      <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
      {delta !== undefined && (
        <div
          title="Variation vs extraction précédente"
          className={`mt-1 text-xs font-semibold ${
            delta === null
              ? "text-slate-400 dark:text-slate-500"
              : delta > 0
                ? "text-red-600 dark:text-red-400"
                : delta < 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`}
          <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">vs N-1</span>
        </div>
      )}
    </div>
  );
  if (href) return <a href={href} className="block hover:shadow-md transition-shadow">{inner}</a>;
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
            {s.extraction_date} — {s.file_name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Legend() {
  return (
    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
      <strong className="dark:text-slate-200">Seuils SPOT (informatifs, déjà appliqués) :</strong> Air : 5 jours · Maritime & Route locale : 10 jours ·
      Maritime Hinterland : 15 jours. L&apos;application n&apos;invente aucune règle métier et ne recalcule pas les retards.
      Un dossier peut apparaître dans plusieurs catégories : la somme des catégories n&apos;est jamais un nombre de dossiers distincts.
    </div>
  );
}
