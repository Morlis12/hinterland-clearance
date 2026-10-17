export const DEMO_EXTRACTION_DATE = "2026-09-23";
export const DEMO_FILE_NAME = "DÉMO - Overdue_Files_SPOT.xlsx";

// Hôtes autorisés pour les scripts DÉMO : jamais une base distante.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db"]);

export function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }
  if (!LOCAL_HOSTS.has(host)) {
    console.error(
      "Refusé : les scripts de démonstration ne s'exécutent que sur une base locale " +
        "(DATABASE_URL absente ou non locale). Aucune donnée n'a été modifiée."
    );
    process.exit(1);
  }
}
