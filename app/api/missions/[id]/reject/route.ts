import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";
import { approvalSchema } from "@/lib/validation";
import { emitEvent } from "@/lib/events/bus";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { const { stepId } = approvalSchema.parse(await request.json()); const approval = await prisma.approval.updateMany({ where: { missionId: id, stepId, status: "PENDING" }, data: { status: "REJECTED", rejectedAt: new Date() } }); if (approval.count !== 1) return NextResponse.json({ error: "Pending approval not found" }, { status: 404 }); await prisma.agentStep.update({ where: { id: stepId }, data: { status: "SKIPPED" } }); await prisma.mission.update({ where: { id }, data: { status: "PAUSED" } }); await emitEvent({ missionId: id, stepId, eventType: "APPROVAL_REJECTED", message: "Human approval rejected; consequential action was not executed" }); return NextResponse.json({ status: "rejected" }); }
  catch (error) { return errorResponse(error, 400); }
}
