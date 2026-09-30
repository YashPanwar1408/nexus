import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try { await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ status: "ok", database: "ok", timestamp: new Date().toISOString() }); }
  catch (error) { return NextResponse.json({ status: "error", database: "unavailable", error: error instanceof Error ? error.message : "Database unavailable" }, { status: 503 }); }
}
