import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const mission = await prisma.mission.findUnique({ where: { id }, include: { steps: { include: { approvals: true, evidence: true }, orderBy: { order: "asc" } }, events: { orderBy: { timestamp: "asc" } } } }); if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 }); return NextResponse.json(mission); }
  catch (error) { return errorResponse(error); }
}
