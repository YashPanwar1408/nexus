import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logExecution } from "@/lib/observability/logger";

type EventListener = (event: {
  id: string;
  missionId: string;
  stepId: string | null;
  eventType: string;
  message: string;
  metadata: Prisma.JsonValue | null;
  timestamp: Date;
}) => void;

const listeners = new Map<string, Set<EventListener>>();

export async function emitEvent(input: {
  missionId: string;
  stepId?: string;
  eventType: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const event = await prisma.executionEvent.create({ data: input });
  logExecution({ missionId: input.missionId, stepId: input.stepId, eventType: input.eventType, message: input.message });
  listeners.get(input.missionId)?.forEach((listener) => listener(event));
  return event;
}

export function subscribeToMission(missionId: string, listener: EventListener) {
  const missionListeners = listeners.get(missionId) ?? new Set<EventListener>();
  missionListeners.add(listener);
  listeners.set(missionId, missionListeners);
  return () => {
    missionListeners.delete(listener);
    if (missionListeners.size === 0) listeners.delete(missionId);
  };
}
