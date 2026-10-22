"use client";
import { useEffect, type ReactNode } from "react";

/** Panneau latéral : s'ouvre au clic sur une carte ou une barre, se ferme par Échap, la croix ou le fond. */
export default function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-marine-950/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900" data-testid="drawer">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-marine-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded border border-slate-300 px-2 py-0.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">✕</button>
        </header>
        <div className="space-y-5 px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
