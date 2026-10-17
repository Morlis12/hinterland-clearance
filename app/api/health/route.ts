import { NextResponse } from "next/server";
import { logger } from "@/src/lib/logger";

export async function GET() {
  logger.info("health check");
  return NextResponse.json({ status: "ok", service: "hinterland", ts: new Date().toISOString() });
}
