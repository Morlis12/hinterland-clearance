import type { ReactNode } from "react";

/** En-tête de page du référentiel : eyebrow en petites capitales, titre, trait d'accent, sous-titre, actions à droite. */
export default function PageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-mut">{eyebrow}</div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-titre">{title}</h1>
        <div className="mt-2 h-1 w-12 rounded bg-acc" />
        {subtitle && <p className="mt-2 max-w-3xl text-sm text-mut">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
