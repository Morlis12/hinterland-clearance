"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Textes d'aide : la méthode, jamais des chiffres (ils changent à chaque extraction). */
export type HelpText = { t: string; q: string; r: string; k: string; w?: string };

const VARIATION =
  "En bas de carte : la variation par rapport à l'extraction précédente. Rouge = plus de dossiers en retard (dégradation), vert = moins (amélioration), gris = stable.";

export const HELP: Record<string, HelpText> = {
  total: {
    t: "Total des dossiers en retard",
    q: "Nombre de dossiers distincts qui figurent dans au moins une catégorie de retard de l'extraction SPOT sélectionnée.",
    r: VARIATION,
    k: "C'est le seul chiffre qui compte des dossiers uniques : un même dossier peut apparaître dans plusieurs catégories.",
    w: "Ne jamais additionner les catégories pour retrouver ce total : les dossiers présents dans plusieurs catégories seraient comptés plusieurs fois.",
  },
  category: {
    t: "Dossiers en retard d'une catégorie",
    q: "Nombre de dossiers marqués en retard pour cette catégorie dans l'extraction SPOT. Les seuils de retard (Air 5 jours, Maritime et Route locale 10 jours, Maritime Hinterland 15 jours) sont déjà appliqués par SPOT : l'application ne recalcule rien.",
    r: VARIATION,
    k: "Cliquez sur la carte pour voir l'évolution dans le temps, les COM les plus concernés et la liste des dossiers.",
    w: "Un dossier peut compter dans plusieurs catégories à la fois.",
  },
  chart_cat: {
    t: "Retards par catégorie",
    q: "Une barre par catégorie : le nombre de dossiers en retard dans l'extraction sélectionnée, avec les filtres actifs.",
    r: "Plus la barre est longue, plus la catégorie pèse. Survolez une barre pour voir la part du total et la variation. Cliquez sur une barre pour ouvrir le détail de la catégorie.",
    k: "Repérer d'abord les catégories dominantes, puis ouvrir leur détail pour trouver où agir.",
    w: "La somme des barres dépasse le nombre de dossiers distincts.",
  },
  chart_com: {
    t: "Retards par COM",
    q: "Les COM (collaborateurs en charge des dossiers) classés par nombre de dossiers en retard, tous types confondus.",
    r: "Chaque barre est un COM. Cliquez sur une barre pour voir sa répartition par catégorie et son évolution.",
    k: "Une poignée de COM concentre souvent l'essentiel des retards : c'est là que l'action a le plus d'effet.",
  },
  trend: {
    t: "Évolution dans le temps",
    q: "Le nombre de dossiers en retard à chaque extraction chargée, placé à la date de l'extraction.",
    r: "Chaque point est une extraction. Survolez-le pour voir aussi la date de chargement du fichier. Cliquez sur un point pour afficher cette extraction dans le tableau de bord.",
    k: "Date d'extraction = date du fichier SPOT. Date de chargement = jour où le fichier a été déposé dans l'application.",
  },
  mini_evolution: {
    t: "Mini-évolution",
    q: "Comparaison des principaux indicateurs entre l'extraction précédente (N-1) et l'extraction affichée (N).",
    r: "Rouge = hausse des retards, vert = baisse. Le pourcentage est omis quand N-1 vaut zéro.",
    k: "Pour comparer deux autres extractions, utilisez la page Évolution.",
  },
};

export function HelpBubble({ id, className = "" }: { id: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const h = HELP[id];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (!h) return null;
  // Portail vers <body> : une carte qui se soulève au survol (transform) devient le repère d'un élément « fixed »
  // placé à l'intérieur ; la fenêtre s'affichait alors en longue bande verticale dans la carte.
  const modal = open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-marine-950/50 p-4" onClick={(e) => { e.stopPropagation(); setOpen(false); }} role="dialog" aria-modal="true" aria-label={h.t}>
          <div className="max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-xl border-t-4 border-gold-300 bg-white p-6 text-sm leading-relaxed text-slate-800 shadow-2xl dark:bg-slate-900 dark:text-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-lg font-bold text-marine-900 dark:text-white">{h.t}</div>
            <Block k="C'est quoi">{h.q}</Block>
            <Block k="Comment le lire">{h.r}</Block>
            <Block k="À retenir">{h.k}</Block>
            {h.w && <Block k="Précaution" warn>{h.w}</Block>}
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); }} className="mt-4 rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Fermer</button>
          </div>
        </div>,
        document.body
      ) : null;
  return (
    <>
      <button
        type="button"
        aria-label={`Aide : ${h.t}`}
        title={`Aide : ${h.t}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-marine-800 font-serif text-[11px] font-bold italic text-gold-300 hover:bg-marine-600 dark:bg-gold-300 dark:text-marine-900 ${className}`}
      >
        i
      </button>
      {modal}
    </>
  );
}

function Block({ k, children, warn }: { k: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="mt-3">
      <div className={`text-[11px] font-bold uppercase tracking-wide ${warn ? "text-amber-700 dark:text-amber-400" : "text-gold-500"}`}>{k}</div>
      <p>{children}</p>
    </div>
  );
}
