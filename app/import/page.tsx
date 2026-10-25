"use client";
import { useEffect, useRef, useState } from "react";
import { formatDateFR } from "@/components/ui";
import PageHeader from "@/components/PageHeader";

const MAX_BYTES = 4718592;
const MO = 1048576;

type ItemStatus = "analyzing" | "ready" | "importing" | "done" | "duplicate" | "error" | "failed";

type QueueItem = {
  id: number;
  file: File;
  status: ItemStatus;
  preview?: any;
  error?: string;
  importId?: number;
  rowCount?: number;
  importStatus?: string;
};

export default function ImportPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const idRef = useRef(1);
  const queueRef = useRef<QueueItem[]>([]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const loadHistory = async () => {
    const r = await fetch("/api/imports").then((x) => x.json());
    setHistory(r.imports ?? []);
  };
  useEffect(() => { loadHistory(); }, []);

  const patch = (id: number, p: Partial<QueueItem>) =>
    setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const addFiles = async (list: FileList | File[]) => {
    setMsg("");
    const files = Array.from(list);
    if (files.length === 0) return;
    const added: QueueItem[] = files.map((f) => ({ id: idRef.current++, file: f, status: "analyzing" }));
    setQueue((q) => [...q, ...added]);
    for (const it of added) {
      if (!/\.xlsx$/i.test(it.file.name)) {
        patch(it.id, { status: "error", error: "Format non reconnu : seuls les fichiers .xlsx sont acceptés." });
        continue;
      }
      if (it.file.size > MAX_BYTES) {
        patch(it.id, { status: "error", error: `Fichier trop volumineux (${(it.file.size / MO).toFixed(1)} Mo, maximum ${(MAX_BYTES / MO).toFixed(1)} Mo).` });
        continue;
      }
      try {
        const fd = new FormData();
        fd.append("file", it.file);
        const r = await fetch("/api/import?preview=1", { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) patch(it.id, { status: "error", error: j.error ?? "Analyse impossible." });
        else if (j.errors?.length) patch(it.id, { status: "error", preview: j, error: j.errors.join(" ") });
        else patch(it.id, { status: "ready", preview: j });
      } catch {
        patch(it.id, { status: "error", error: "Erreur réseau pendant l'analyse du fichier." });
      }
    }
  };

  const importItem = async (item: QueueItem, force = false): Promise<boolean> => {
    patch(item.id, { status: "importing", error: undefined });
    try {
      const fd = new FormData();
      fd.append("file", item.file);
      const r = await fetch(`/api/import${force ? "?force=1" : ""}`, { method: "POST", body: fd });
      const j = await r.json();
      if (r.status === 409 && j.duplicate) {
        patch(item.id, { status: "duplicate", error: j.error });
        return false;
      }
      if (!r.ok) {
        patch(item.id, { status: "failed", error: j.error ?? "Échec de l'import." });
        return false;
      }
      patch(item.id, { status: "done", importId: j.importId, rowCount: j.rowCount, importStatus: j.status });
      return true;
    } catch {
      patch(item.id, { status: "failed", error: "Erreur réseau pendant l'import." });
      return false;
    }
  };

  const readyCount = queue.filter((i) => i.status === "ready").length;
  const busy = queue.some((i) => i.status === "analyzing" || i.status === "importing");

  const importAll = async () => {
    if (busy) return;
    setMsg("");
    const todo = queueRef.current.filter((i) => i.status === "ready");
    let ok = 0;
    let ko = 0;
    for (const it of todo) {
      if (await importItem(it)) ok += 1;
      else ko += 1;
    }
    await loadHistory();
    const parts: string[] = [];
    if (ok > 0) parts.push(`${ok} fichier${ok > 1 ? "s" : ""} importé${ok > 1 ? "s" : ""}.`);
    if (ko > 0) parts.push(`${ko} fichier${ko > 1 ? "s" : ""} à vérifier ci-dessous.`);
    setMsg(parts.join(" ") || "Aucun fichier prêt à importer.");
  };

  const importOne = async (item: QueueItem, force = false) => {
    setMsg("");
    if (await importItem(item, force)) {
      await loadHistory();
      setMsg(`Fichier « ${item.file.name} » importé.`);
    }
  };

  const removeItem = (id: number) => setQueue((q) => q.filter((x) => x.id !== id));
  const clearQueue = () => setQueue((q) => q.filter((x) => x.status === "analyzing" || x.status === "importing"));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Overdue / Administration" title="Import des données" subtitle="Dépôt des extractions Excel SPOT et historique des chargements." />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        className={`rounded-lg border-2 border-dashed bg-panel p-8 text-center ${dragOver ? "border-marine-600 bg-hl" : "border-line "}`}
      >
        <p className="font-medium">Glissez-déposez vos fichiers ici (.xlsx, 4,5 Mo max chacun)</p>
        <p className="text-xs text-mut">
          Vous pouvez en déposer autant que nécessaire : chaque fichier est analysé puis importé à la suite.
          La date d&apos;extraction est lue automatiquement dans chaque fichier. Aucun fichier n&apos;est conservé,
          seules les lignes sont enregistrées.
        </p>
        <input
          type="file" accept=".xlsx" multiple className="mx-auto mt-3 block text-sm"
          onChange={(e) => { addFiles(e.target.files ?? []); e.target.value = ""; }}
        />
      </div>

      {msg && <div className="rounded-lg border border-ok bg-ok-bg p-3 text-sm text-ok">{msg}</div>}

      {queue.length > 0 && (
        <div className="rounded-2xl border border-line bg-panel p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Fichiers à traiter ({queue.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={importAll} disabled={busy || readyCount === 0}
                className="rounded bg-marine-800 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-gold-300 dark:text-marine-900 dark:hover:bg-gold-400"
              >
                Importer {readyCount > 0 ? `les ${readyCount} fichier${readyCount > 1 ? "s" : ""} prêt${readyCount > 1 ? "s" : ""}` : "tout"}
              </button>
              <button onClick={clearQueue} disabled={busy} className="rounded border border-line px-4 py-2 text-sm disabled:opacity-40">
                Vider la liste
              </button>
            </div>
          </div>

          <div>
            {queue.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {i.file.name} <span className="font-normal text-xs text-mut">({(i.file.size / 1024).toFixed(0)} Ko)</span>
                  </p>
                  {i.preview && (
                    <p className="text-xs text-mut">
                      Extraction : <strong>{formatDateFR(i.preview.extractionDate) || "introuvable"}</strong> · {i.preview.detailCount} dossiers · {i.preview.summaryCount} COM · {i.preview.subtotalCount} sous-totaux
                      {i.preview.warnings?.length ? ` · ${i.preview.warnings.length} avertissement${i.preview.warnings.length > 1 ? "s" : ""}` : ""}
                    </p>
                  )}
                  {i.status === "done" && (
                    <p className="text-xs text-ok">Import #{i.importId} : {Number(i.rowCount ?? 0).toLocaleString("fr-FR")} lignes enregistrées.</p>
                  )}
                  {i.status === "duplicate" && (
                    <p className="text-xs text-warn">Ce fichier a déjà été importé. Vous pouvez le conserver une seconde fois si c&apos;est volontaire.</p>
                  )}
                  {i.error && i.status !== "duplicate" && <p className="text-xs text-bad">{i.error}</p>}
                  {!!i.preview?.warnings?.length && i.status !== "error" && (
                    <details className="mt-1 text-xs text-warn">
                      <summary className="cursor-pointer">Avertissements ({i.preview.warnings.length})</summary>
                      <ul className="ml-5 list-disc">{i.preview.warnings.map((w: string, k: number) => <li key={k}>{w}</li>)}</ul>
                    </details>
                  )}
                </div>
                <StatusChip status={i.status} importId={i.importId} />
                <div className="flex gap-2">
                  {i.status === "ready" && (
                    <button onClick={() => importOne(i)} className="rounded border border-marine-800 px-3 py-1 text-xs text-marine-800 hover:bg-marine-800 hover:text-white dark:border-gold-300 dark:text-gold-300 dark:hover:bg-gold-300 dark:hover:text-marine-900">
                      Importer
                    </button>
                  )}
                  {i.status === "duplicate" && (
                    <button onClick={() => importOne(i, true)} className="rounded-lg border border-warn px-3 py-1 text-xs font-semibold text-warn hover:bg-warn hover:text-panel">
                      Importer quand même
                    </button>
                  )}
                  {i.status === "failed" && (
                    <button onClick={() => importOne(i)} className="rounded border border-marine-800 px-3 py-1 text-xs text-marine-800 hover:bg-marine-800 hover:text-white dark:border-gold-300 dark:text-gold-300 dark:hover:bg-gold-300 dark:hover:text-marine-900">
                      Réessayer
                    </button>
                  )}
                  <button
                    onClick={() => removeItem(i.id)} disabled={i.status === "importing" || i.status === "analyzing"}
                    className="rounded border border-line px-3 py-1 text-xs disabled:opacity-40"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-panel p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Historique des imports (snapshots)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="text-left"><th>#</th><th>Fichier</th><th>Type</th><th>Extraction</th><th>Chargé le</th><th>Lignes</th><th>Statut</th><th>Origine</th></tr></thead>
            <tbody>
              {history.map((h: any) => (
                <tr key={h.id} className="border-t">
                  <td>{h.id}</td><td>{h.fileName}</td><td>{h.fileType}</td><td>{formatDateFR(h.extractionDate)}</td>
                  <td>{new Date(h.loadedAt).toLocaleString("fr-FR")}</td><td className="text-right">{Number(h.rowCount).toLocaleString("fr-FR")}</td>
                  <td><StatusBadge status={h.status} /></td><td>{h.origin === "demo" ? "DÉMO" : h.origin}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-mut">Aucun import pour l&apos;instant.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status, importId }: { status: ItemStatus; importId?: number }) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    analyzing: { label: "Analyse…", cls: "bg-chip text-mut  " },
    ready: { label: "Prêt", cls: "bg-gold-100 text-marine-900 dark:bg-gold-300/15 dark:text-gold-200" },
    importing: { label: "Import en cours…", cls: "bg-warn-bg text-warn" },
    done: { label: importId ? `Importé #${importId}` : "Importé", cls: "bg-ok-bg text-ok" },
    duplicate: { label: "Déjà importé", cls: "bg-warn-bg text-warn" },
    error: { label: "Erreur", cls: "bg-bad-bg text-bad" },
    failed: { label: "Échec", cls: "bg-bad-bg text-bad" },
  };
  const m = map[status];
  return <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs ${m.cls}`}>{m.label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-ok-bg text-ok",
    warnings: "bg-warn-bg text-warn",
    failed: "bg-bad-bg text-bad",
  };
  const label: Record<string, string> = { success: "Réussi", warnings: "Avertissements", failed: "Échec" };
  return <span className={`rounded px-2 py-0.5 ${map[status] ?? "bg-chip"}`}>{label[status] ?? status}</span>;
}
