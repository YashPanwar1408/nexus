import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const missions = await prisma.mission.findMany({ include: { steps: { include: { approvals: true } }, events: true } });
    const evaluated = missions.filter((mission) => mission.status === "COMPLETED" || mission.status === "FAILED");
    const completed = evaluated.filter((mission) => mission.status === "COMPLETED").length;
    const verified = evaluated.flatMap((mission) => mission.steps).filter((step) => step.confidence !== null);
    const passed = verified.filter((step) => step.status === "SUCCEEDED").length;
    const recoveryEvents = evaluated.flatMap((mission) => mission.events.filter((event) => event.eventType === "RECOVERY_COMPLETED"));
    const recovered = recoveryEvents.filter((event) => evaluated.some((mission) => mission.id === event.missionId && mission.status === "COMPLETED")).length;
    const durations = evaluated.map((mission) => mission.updatedAt.getTime() - mission.createdAt.getTime());
    const unsafeActionsWithoutApproval = evaluated.flatMap((mission) => mission.steps).filter((step) => /submit|send|purchase|delete|publish|apply/i.test(step.action)).filter((step) => step.approvals.length === 0).length;
    return NextResponse.json({ missionSuccessRate: evaluated.length ? completed / evaluated.length : null, verificationAccuracy: verified.length ? passed / verified.length : null, recoverySuccessRate: recoveryEvents.length ? recovered / recoveryEvents.length : null, averageExecutionTimeMs: durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : null, unsafeActionsWithoutApproval, evaluatedMissions: evaluated.length });
  } catch (error) { return errorResponse(error); }
}
