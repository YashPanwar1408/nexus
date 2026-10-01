import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";
import { profileSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try { const userId = new URL(request.url).searchParams.get("userId") ?? "local-user"; const profile = await prisma.userProfile.findUnique({ where: { userId }, include: { resumes: true } }); return NextResponse.json(profile); } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try { const input = profileSchema.parse(await request.json()); const { confirmed, ...data } = input; const jsonData = { ...data, skills: data.skills as Prisma.InputJsonValue, experience: data.experience as Prisma.InputJsonValue, projects: data.projects as Prisma.InputJsonValue, preferredRoles: data.preferredRoles as Prisma.InputJsonValue, preferredLocations: data.preferredLocations as Prisma.InputJsonValue }; const profile = await prisma.userProfile.upsert({ where: { userId: input.userId }, update: { ...jsonData, confirmedAt: confirmed ? new Date() : null }, create: { ...jsonData, confirmedAt: confirmed ? new Date() : null } }); return NextResponse.json(profile); } catch (error) { return errorResponse(error, 400); }
}
