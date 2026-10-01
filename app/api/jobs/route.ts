import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";

export async function GET(request: Request) {
  try { const searchId = new URL(request.url).searchParams.get("searchId"); const jobs = await prisma.job.findMany({ where: searchId ? { searchId } : undefined, include: { matches: searchId ? { where: { searchId } } : { orderBy: { score: "desc" }, take: 1 }, shortlist: true, application: true }, orderBy: { extractedAt: "desc" } }); return NextResponse.json(jobs); } catch (error) { return errorResponse(error); }
}
