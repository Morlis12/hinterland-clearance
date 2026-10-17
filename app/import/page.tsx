"use client";
import { useEffect, useState } from "react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadHistory = async () => {
    const r = await fetch("/api/imports").then((x) => x.json());
    setHistory(r.imports ?? []);
  };
  useEffect(() => { loadHistory(); }, []);

  const doPreview = async (f: File) => {
    setErr(""); setMsg(""); setPreview(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/import?preview=1", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Erreur d'analyse.");
      else setPreview(j);
    } finally { setBusy(false); }
  };

  const doImport = async (force = false) => {
    if (!file) return;
    setErr(""); setMsg("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/import${force ? "?force=1" : ""}`, { method: "POST", body: fd });
      const j = await r.json();
      if (r.status === 409 && j.duplicate) {
        setErr(j.error + " " + j.confirmHint);
        setPreview((p: any) => ({ ...p, needConfirm: true }));
        return;
      }
      if (!r.ok) { setErr(j.error ?? "Échec d'import."); return; }
      setMsg(`Import #${j.importId} réussi : ${j.rowCount} dossiers, extraction ${j.extractionDate}, statut ${j.status}.`);
      setPreview(null); setFile(null);
      loadHistory();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-marine-900 dark:text-white">Import des données</h1>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); doPreview(f); } }}
        className={`rounded-lg border-2 border-dashed bg-white p-8 text-center ${dragOver ? "border-marine-600 bg-blue-50 dark:bg-slate-800" : "border-slate-300 dark:border-slate-700 dark:bg-slate-900"}`}
      >
        <p className="font-medium">Glissez-déposez le Fichier A (.xlsx, ≤ 4 Mo) ici</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Overdue_Files_SPOT.xlsx — Sheet1 + Sheet2. Les fichiers ne sont pas conservés : seules les lignes sont stockées en base.</p>
        <input
          type="file" accept=".xlsx" className="mx-auto mt-3 block text-sm"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); doPreview(f); } }}
        />
        {file && <p className="mt-2 text-sm">Fichier : <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} Ko)</p>}
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-100">
        Fichier B (Dossiers_Hinterland_Non_Archivés_par_COM.xlsx, &gt; 1 M de lignes, feuille Feuil1) : <strong>jamais par le navigateur</strong>. Utilisez le script CLI :{" "}
        <code className="rounded bg-white px-1 dark:bg-slate-800">npm run import -- --file chemin.xlsx --date AAAA-MM-JJ</code>
      </div>

      {busy && <p className="text-sm text-slate-500 dark:text-slate-400">Traitement en cours…</p>}
      {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">{err}</div>}
      {msg && <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-800 dark:bg-green-950/40 dark:border-green-900 dark:text-green-300">{msg}</div>}

      {preview && (
        <div className="rounded-lg bg-white p-4 shadow-sm space-y-3 dark:bg-slate-900 dark:shadow-none">
          <h2 className="font-semibold">Contrôle avant validation</h2>
          <div className="text-sm">Date d&apos;extraction (lue dans le fichier) : <strong>{preview.extractionDate || "introuvable"}</strong> · Résumé : {preview.summaryCount} COM · Sous-totaux : {preview.subtotalCount} · Détail : {preview.detailCount} dossiers</div>
          {!!preview.errors?.length && <div className="text-sm text-red-600">Erreurs :<ul className="list-disc ml-5">{preview.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul></div>}
          {!!preview.warnings?.length && <div className="text-sm text-amber-700">Avertissements :<ul className="list-disc ml-5">{preview.warnings.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul></div>}
          {!!preview.rulesInfo?.length && <div className="text-xs text-slate-500 dark:text-slate-400">Règles lues en bas de Sheet1 : {preview.rulesInfo.join(" · ").slice(0, 400)}</div>}
          {preview.preview?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr className="text-left text-slate-500 dark:text-slate-400"><th>Dossier</th><th>Agence</th><th>COM</th><th>Archiv.</th><th>Débours</th></tr></thead>
                <tbody>{preview.preview.map((r: any, i: number) => <tr key={i} className="border-t dark:border-slate-800"><td className="font-mono">{r.dossier}</td><td>{r.agence}</td><td>{r.com}</td><td>{r.flags.archivage}</td><td>{r.flags.debours}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2">
            <button disabled={busy || preview.errors?.length > 0} onClick={() => doImport(false)} className="rounded bg-marine-800 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-gold-300 dark:text-marine-900 dark:hover:bg-gold-400">Valider l&apos;import</button>
            {preview.needConfirm && <button onClick={() => doImport(true)} className="rounded border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">Confirmer le doublon (conserver les deux)</button>}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none">
        <h2 className="mb-2 font-semibold">Historique des imports (snapshots)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="text-left text-slate-500 dark:text-slate-400"><th>#</th><th>Fichier</th><th>Type</th><th>Extraction</th><th>Chargé le</th><th>Lignes</th><th>Statut</th><th>Origine</th></tr></thead>
            <tbody>
              {history.map((h: any) => (
                <tr key={h.id} className="border-t dark:border-slate-800">
                  <td>{h.id}</td><td>{h.fileName}</td><td>{h.fileType}</td><td>{String(h.extractionDate).slice(0, 10)}</td>
                  <td>{new Date(h.loadedAt).toLocaleString("fr-FR")}</td><td className="text-right">{Number(h.rowCount).toLocaleString("fr-FR")}</td>
                  <td><StatusBadge status={h.status} /></td><td>{h.origin}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-slate-400 dark:text-slate-500">Aucun import pour l&apos;instant.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-green-100 text-green-800",
    warnings: "bg-amber-100 text-amber-800",
    failed: "bg-red-100 text-red-700",
  };
  const label: Record<string, string> = { success: "Réussi", warnings: "Avertissements", failed: "Échec" };
  return <span className={`rounded px-2 py-0.5 ${map[status] ?? "bg-slate-100"}`}>{label[status] ?? status}</span>;
}
