import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";
import { config } from "@/src/lib/env";
import { logger } from "@/src/lib/logger";
import { detectKindFromBuffer, importBufferA } from "@/src/lib/import/index";
import { parseFileA } from "@/src/lib/import/readA";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";
export const maxDuration = 60;

const CLI_HINT =
  "Pour les fichiers volumineux (Fichier B ou > 4 Mo), utilisez le script CLI : npm run import -- --file chemin.xlsx --date AAAA-MM-JJ";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const previewOnly = url.searchParams.get("preview") === "1";
  const force = url.searchParams.get("force") === "1";

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire multipart invalide." }, { status: 400 });
  }
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Aucun fichier reçu (champ « file »)." }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) {
    return NextResponse.json({ error: "Seuls les fichiers .xlsx sont acceptés." }, { status: 400 });
  }
  const maxBytes = config.maxUploadBytes;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (${(file.size / 1048576).toFixed(1)} Mo > ${(maxBytes / 1048576).toFixed(1)} Mo). ${CLI_HINT}` },
      { status: 413 }
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const pool = getPool();

  const detected = await detectKindFromBuffer(buffer);
  if (detected.kind === "B" || detected.kind === "unknown") {
    return NextResponse.json(
      {
        error:
          detected.kind === "B"
            ? `Fichier B détecté (feuille Feuil1, gros volume) : l'import web est interdit. ${CLI_HINT}`
            : `Type de fichier non reconnu (feuilles : ${detected.sheets.join(", ")}). ${CLI_HINT}`,
      },
      { status: 415 }
    );
  }

  if (previewOnly) {
    const parsed = await parseFileA(buffer, file.name);
    return NextResponse.json({
      fileName: file.name,
      sha256: parsed.sha256,
      extractionDate: parsed.extractionDate,
      errors: parsed.errors,
      warnings: parsed.warnings,
      summaryCount: parsed.summaryRows.length,
      subtotalCount: parsed.subtotalRows.length,
      detailCount: parsed.detailRows.length,
      preview: parsed.preview,
      rulesInfo: parsed.rulesInfo,
    });
  }

  try {
    const res = await importBufferA(pool, buffer, file.name, { origin: "web", force });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const err = e as Error & { duplicate?: boolean; duplicates?: unknown; importId?: number };
    if (err.duplicate) {
      logger.warn("import web doublon, confirmation requise", { file: file.name });
      return NextResponse.json(
        { error: err.message, duplicate: true, duplicates: err.duplicates, confirmHint: "Relancez avec ?force=1 pour conserver les deux imports." },
        { status: 409 }
      );
    }
    logger.error("import web échec", { error: String(e), file: file.name });
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
