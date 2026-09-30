import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";
import { createMissionSchema } from "@/lib/validation";

export async function GET() {
  try {
    const missions = await prisma.mission.findMany({ orderBy: { updatedAt: "desc" }, take: 50, include: { steps: { select: { status: true } } } });
    return NextResponse.json(missions);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try { const input = createMissionSchema.parse(await request.json()); const mission = await prisma.mission.create({ data: input }); return NextResponse.json(mission, { status: 201 }); }
  catch (error) { return errorResponse(error, 400); }
}
