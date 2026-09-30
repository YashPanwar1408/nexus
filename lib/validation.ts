import { z } from "zod";

export const createMissionSchema = z.object({ userId: z.string().min(1).default("local-user"), goal: z.string().min(10).max(2000) });
export const approvalSchema = z.object({ stepId: z.string().min(1) });
