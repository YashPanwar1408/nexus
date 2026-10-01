import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { jobSearchSchema } from "@/lib/validation";
import { searchAndPersistJobs } from "@/lib/jobs/service";

export async function POST(request: Request) {
  try {
    const input = jobSearchSchema.parse(await request.json());
    const profile = await prisma.userProfile.findUnique({ where: { id: input.profileId } });
    if (!profile?.confirmedAt) return NextResponse.json({ error: "Confirm a user profile before searching jobs" }, { status: 409 });
    return NextResponse.json(await searchAndPersistJobs({ profileId: input.profileId, query: input, missionId: input.missionId }), { status: 201 });
  } catch (error) { return errorResponse(error, 400); }
}
