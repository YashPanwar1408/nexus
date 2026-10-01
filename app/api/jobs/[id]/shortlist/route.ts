import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { const job = await prisma.job.findUnique({ where: { id } }); if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 }); const shortlist = await prisma.shortlist.upsert({ where: { jobId: id }, update: { status: "SHORTLISTED" }, create: { jobId: id, status: "SHORTLISTED" } }); return NextResponse.json(shortlist, { status: 201 }); } catch (error) { return errorResponse(error, 400); }
}
