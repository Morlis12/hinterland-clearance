#!/usr/bin/env tsx
/**
 * CLI d'import — Fichiers A et B.
 * Usage :
 *   npm run import -- --file chemin.xlsx --date AAAA-MM-JJ [--force] [--batch 5000]
 * La date est facultative pour le Fichier A (lue dans le fichier), obligatoire pour le Fichier B.
 */
import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import { getPool } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { detectKindFromBuffer, importFileA } from "../src/lib/import/index";
import { detectKindFromPath, importFileB } from "../src/lib/import/cli";
import { readFileSync } from "node:fs";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  const pref = process.argv.find((a) => a.startsWith(name + "="));
  if (pref) return pref.split("=").slice(1).join("=");
  return undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const file = arg("--file");
  const date = arg("--date");
  const force = flag("--force");
  const batch = Number(arg("--batch") ?? 5000);
  if (!file) {
    console.error("Usage : npm run import -- --file chemin.xlsx [--date AAAA-MM-JJ] [--force] [--batch 5000]");
    process.exit(2);
  }
  if (!existsSync(file)) {
    console.error(`Fichier introuvable : ${file}`);
    process.exit(2);
  }
  const pool = getPool();
  try {
    await pool.query("SELECT 1");
  } catch (e) {
    console.error(`Connexion base impossible (DATABASE_URL). Détail : ${String(e)}`);
    process.exit(1);
  }

  // Détection du type par feuilles/en-têtes (pas par le nom).
  // Fichiers volumineux (>10 Mo) : détection légère par workbook.xml uniquement
  // (ExcelJS en mémoire exploserait sur le Fichier B de 41 Mo).
  const size = statSync(file).size;
  let kind: string = "unknown";
  let sheets: string[] = [];
  try {
    if (size > 10 * 1024 * 1024) {
      const r = await detectKindFromPath(file);
      kind = r.kind; sheets = r.sheets;
      logger.info("fichier détecté (léger, volumineux)", { file: basename(file), kind, sheets, size });
    } else {
      const buffer = readFileSync(file);
      const r = await detectKindFromBuffer(buffer);
      kind = r.kind; sheets = r.sheets;
      logger.info("fichier détecté", { file: basename(file), kind: r.kind, sheets });
    }
    if (kind === "B") {
      if (!date) {
        console.error("Le Fichier B (Feuil1) exige --date AAAA-MM-JJ (aucune date d'extraction dans le fichier).");
        process.exit(2);
      }
      let last = 0;
      const res = await importFileB(pool, file, {
        origin: "cli", extractionDate: date, force, batchSize: batch,
        onProgress: (read) => {
          if (read - last >= 50000) {
            last = read;
            process.stdout.write(`\r  … ${read.toLocaleString("fr-FR")} lignes lues`);
          }
        },
      });
      process.stdout.write("\n");
      console.log(`OK — import #${res.importId} (${res.fileType}) : ${res.rowCount.toLocaleString("fr-FR")} lignes, extraction ${res.extractionDate}, statut ${res.status}.`);
      if (res.warnings.length) console.log("Avertissements :\n- " + res.warnings.join("\n- "));
    } else if (kind === "A") {
      const res = await importFileA(pool, file, {
        origin: "cli", force, batchSize: 2000, extractionDateOverride: date,
        onProgress: (_rd, ins) => process.stdout.write(`\r  … ${ins.toLocaleString("fr-FR")} dossiers`),
      });
      process.stdout.write("\n");
      console.log(`OK — import #${res.importId} (${res.fileType}) : ${res.rowCount.toLocaleString("fr-FR")} dossiers, extraction ${res.extractionDate}, statut ${res.status}.`);
      if (res.warnings.length) console.log("Avertissements :\n- " + res.warnings.join("\n- "));
    } else {
      console.error(`Type de fichier non reconnu (feuilles : ${sheets.join(", ")} ; ni Fichier A Sheet1/Sheet2, ni Fichier B Feuil1).`);
      process.exit(2);
    }
  } catch (e) {
    const err = e as Error & { duplicate?: boolean };
    if (err.duplicate) {
      console.error(`DOUBLON : ${err.message}`);
      console.error("Relancez avec --force pour conserver les deux imports (le plus récent fera foi).");
      process.exit(3);
    }
    console.error(`ÉCHEC : ${(e as Error).message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
