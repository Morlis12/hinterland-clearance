"use client";
import { useEffect, useState } from "react";
import { formatDateFR, formatDateTimeFR } from "@/components/ui";

export type SnapshotMeta = { id: number; file_name: string; extraction_date: string; loaded_at: string; origin?: string };

let cache: Promise<SnapshotMeta[]> | null = null;
function loadSnapshots(): Promise<SnapshotMeta[]> {
  if (!cache) {
    cache = fetch("/api/snapshots")
      .then((r) => r.json())
      .then((j) => (j.snapshots ?? []).filter((s: any) => s.file_type === "A" && (s.status === "success" || s.status === "warnings")))
      .catch(() => { cache = null; return []; });
  }
  return cache;
}

/** Bandeau des dates : extraction (date du fichier SPOT) et chargement (date de dépôt dans l'application). */
export default function SnapshotBanner({ snapshotId, previousId }: { snapshotId?: number | null; previousId?: number | null }) {
  const [snaps, setSnaps] = useState<SnapshotMeta[]>([]);
  useEffect(() => { loadSnapshots().then(setSnaps); }, [snapshotId]);
  if (snaps.length === 0) return null;
  const cur = snaps.find((s) => s.id === snapshotId) ?? snaps[0];
  const idx = snaps.findIndex((s) => s.id === cur.id);
  const prev = snaps.find((s) => s.id === previousId) ?? (idx >= 0 ? snaps[idx + 1] : undefined);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-line border-l-4 border-l-acc bg-hl px-4 py-2.5 text-xs text-ink" data-testid="snapshot-banner">
      <span><strong className="text-titre">Extraction du {formatDateFR(cur.extraction_date)}</strong></span>
      <span>Fichier « {cur.file_name} » chargé le <strong>{formatDateTimeFR(cur.loaded_at)}</strong>{cur.origin ? ` (${cur.origin === "web" ? "web" : "ligne de commande"})` : ""}</span>
      {prev ? <span>Comparé à l&apos;extraction du <strong>{formatDateFR(prev.extraction_date)}</strong> (chargée le {formatDateTimeFR(prev.loaded_at)})</span> : <span>Aucune extraction précédente à comparer</span>}
    </div>
  );
}
