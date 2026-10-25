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
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-panel shadow-2xl" data-testid="drawer">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-panel px-5 py-4">
          <h2 className="text-lg font-bold text-titre">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded border border-line px-2 py-0.5 text-sm hover:bg-panel2">✕</button>
        </header>
        <div className="space-y-5 px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
