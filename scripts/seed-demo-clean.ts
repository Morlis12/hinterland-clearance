import { getPool } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { assertLocalDatabase } from "./demo-shared";

/** Retire UNIQUEMENT le snapshot DÉMO (origin='demo') et ses lignes. LOCAL UNIQUEMENT. */
async function main() {
  assertLocalDatabase();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = (await client.query(`SELECT id FROM imports WHERE origin='demo'`)).rows.map(
      (r: { id: number }) => r.id
    );
    if (ids.length === 0) {
      await client.query("ROLLBACK");
      logger.info("aucun snapshot DÉMO à retirer");
      return;
    }
    for (const table of ["raw_dossier_details", "raw_com_summary", "raw_unarchived"]) {
      await client.query(`DELETE FROM ${table} WHERE import_id = ANY($1::int[])`, [ids]);
    }
    await client.query(`DELETE FROM imports WHERE id = ANY($1::int[])`, [ids]);
    await client.query("COMMIT");
    logger.info("snapshot(s) DÉMO retiré(s)", { importIds: ids });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Échec clean DÉMO :", String((e as Error)?.message ?? e));
  process.exit(1);
});
