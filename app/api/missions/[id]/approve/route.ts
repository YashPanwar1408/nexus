import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";
import { approvalSchema } from "@/lib/validation";
import { emitEvent } from "@/lib/events/bus";
import { runMission } from "@/lib/agent/runner";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { const { stepId } = approvalSchema.parse(await request.json()); const pending = await prisma.approval.updateMany({ where: { missionId: id, stepId, status: "PENDING" }, data: { status: "APPROVED", approvedAt: new Date() } }); const approved = await prisma.approval.findFirst({ where: { missionId: id, stepId, status: "APPROVED" } }); if (pending.count === 0 && !approved) return NextResponse.json({ error: "Approval request not found" }, { status: 404 }); await prisma.agentStep.update({ where: { id: stepId }, data: { status: "PENDING" } }); if (pending.count === 1) await emitEvent({ missionId: id, stepId, eventType: "APPROVAL_GRANTED", message: "Human approval recorded; resuming execution" }); const execution = await runMission(id); return NextResponse.json({ status: execution.status }); }
  catch (error) { return errorResponse(error, 400); }
}
