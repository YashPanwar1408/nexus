import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const job = await prisma.job.findUnique({ where: { id }, include: { matches: true, shortlist: true, application: { include: { fields: true, events: true } } } }); if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 }); return NextResponse.json(job); } catch (error) { return errorResponse(error); }
}
