import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "../src/lib/db";
import { logger } from "../src/lib/logger";

async function main() {
  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const pool = getPool();
  for (const f of files) {
    logger.info("application migration", { file: f });
    const sql = readFileSync(join(dir, f), "utf8");
    await pool.query(sql);
  }
  logger.info("migrations terminées", { count: files.length });
  await pool.end();
}

main().catch((e) => {
  logger.error("échec migration", { error: String(e) });
  process.exit(1);
});
