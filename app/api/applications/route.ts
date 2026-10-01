import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";

export async function GET(request: Request) {
  try { const userId = new URL(request.url).searchParams.get("userId") ?? "local-user"; const applications = await prisma.application.findMany({ where: { profile: { userId } }, include: { job: true, fields: true, events: { orderBy: { createdAt: "desc" } } }, orderBy: { updatedAt: "desc" } }); return NextResponse.json(applications); } catch (error) { return errorResponse(error); }
}
