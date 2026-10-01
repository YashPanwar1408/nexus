import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { jobSearchSchema } from "@/lib/validation";
import { searchAndPersistJobs } from "@/lib/jobs/service";

export async function POST(request: Request) {
  try {
    const input = jobSearchSchema.parse(await request.json());
    let profile = input.profileId ? await prisma.userProfile.findUnique({ where: { id: input.profileId } }) : await prisma.userProfile.findUnique({ where: { userId: "local-user" } });
    if (!profile) profile = await prisma.userProfile.create({ data: { userId: "local-user", name: "Unconfirmed candidate", email: "unconfirmed@local.invalid", skills: [], experience: [], projects: [], preferredRoles: [], preferredLocations: [] } });
    return NextResponse.json({ profileId: profile.id, ...(await searchAndPersistJobs({ profileId: profile.id, query: input, missionId: input.missionId })) }, { status: 201 });
  } catch (error) { return errorResponse(error, 400); }
}
