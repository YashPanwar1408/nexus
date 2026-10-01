import { z } from "zod";

export const createMissionSchema = z.object({ userId: z.string().min(1).default("local-user"), goal: z.string().min(10).max(2000) });
export const approvalSchema = z.object({ stepId: z.string().min(1) });
const optionalUrl = z.union([z.string().url(), z.literal(""), z.null()]).optional();
export const profileSchema = z.object({ userId: z.string().min(1).default("local-user"), name: z.string().min(1), email: z.string().email(), phone: z.string().optional().nullable(), college: z.string().optional().nullable(), degree: z.string().optional().nullable(), graduationYear: z.number().int().optional().nullable(), skills: z.array(z.string()).default([]), experience: z.array(z.unknown()).default([]), projects: z.array(z.unknown()).default([]), portfolio: optionalUrl, github: optionalUrl, linkedin: optionalUrl, location: z.string().optional().nullable(), preferredRoles: z.array(z.string()).default([]), preferredLocations: z.array(z.string()).default([]), confirmed: z.boolean().default(false) });
export const jobSearchSchema = z.object({ profileId: z.string().min(1), role: z.string().min(2), location: z.string().default(""), postedWithinHours: z.number().int().positive().max(168).default(48), remoteOnly: z.boolean().default(false), missionId: z.string().optional() });
export const prepareApplicationSchema = z.object({ profileId: z.string().min(1), jobId: z.string().min(1) });
