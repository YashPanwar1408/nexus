import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return NextResponse.json(await prisma.executionEvent.findMany({ where: { missionId: id }, orderBy: { timestamp: "asc" } })); }
  catch (error) { return errorResponse(error); }
}
