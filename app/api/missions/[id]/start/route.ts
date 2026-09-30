import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";
import { planMission } from "@/lib/agent/planner";
import { emitEvent } from "@/lib/events/bus";
import { runMission } from "@/lib/agent/runner";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    if (mission.status !== "DRAFT") {
      if (["RUNNING", "PAUSED", "WAITING_APPROVAL"].includes(mission.status)) return NextResponse.json(await runMission(id));
      return NextResponse.json({ error: `Mission is already ${mission.status}` }, { status: 409 });
    }
    await prisma.mission.update({ where: { id }, data: { status: "PLANNING" } });
    await emitEvent({ missionId: id, eventType: "MISSION_STARTED", message: "Requesting a structured plan from the configured LLM provider" });
    const plan = await planMission(mission.goal);
    await prisma.$transaction(async (transaction) => {
      for (const [index, step] of plan.steps.entries()) {
        const created = await transaction.agentStep.create({ data: { missionId: id, order: index + 1, objective: step.objective, action: step.action, tool: step.tool, target: step.target, expectedOutcome: step.expectedOutcome, status: step.requiresApproval ? "WAITING_APPROVAL" : "PENDING" } });
        if (step.requiresApproval) await transaction.approval.create({ data: { missionId: id, stepId: created.id, action: step.action, target: step.target, reason: step.expectedOutcome, dataShared: step.target, riskLevel: step.riskLevel } });
      }
      await transaction.mission.update({ where: { id }, data: { status: "RUNNING" } });
    });
    await emitEvent({ missionId: id, eventType: "PLAN_CREATED", message: `Plan created with ${plan.steps.length} step(s)` });
    const execution = await runMission(id);
    return NextResponse.json({ status: execution.status, plan });
  } catch (error) {
    await prisma.mission.update({ where: { id }, data: { status: "FAILED" } }).catch(() => undefined);
    await emitEvent({ missionId: id, eventType: "MISSION_FAILED", message: error instanceof Error ? error.message : "Planning failed" }).catch(() => undefined);
    return errorResponse(error, 502);
  }
}
