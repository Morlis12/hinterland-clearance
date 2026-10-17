import { NextResponse } from "next/server";
import { getPool } from "@/src/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const pool = getPool();
  const r = await pool.query(
    `SELECT id, file_name AS "fileName", file_type AS "fileType", extraction_date AS "extractionDate",
      loaded_at AS "loadedAt", row_count AS "rowCount", status, warnings, origin
     FROM imports ORDER BY id DESC LIMIT 100`
  );
  return NextResponse.json({ imports: r.rows });
}
