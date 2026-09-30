import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";
import { emitEvent } from "@/lib/events/bus";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await prisma.mission.updateMany({ where: { id, status: { in: ["DRAFT", "PLANNING", "RUNNING", "WAITING_APPROVAL", "PAUSED"] } }, data: { status: "CANCELLED" } });
    if (result.count !== 1) return NextResponse.json({ error: "Mission is missing or already terminal" }, { status: 409 });
    await emitEvent({ missionId: id, eventType: "MISSION_CANCELLED", message: "Mission cancelled by the user" });
    return NextResponse.json({ status: "CANCELLED" });
  } catch (error) { return errorResponse(error, 400); }
}
