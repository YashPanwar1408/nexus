import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/api";
import { prepareApplicationSchema } from "@/lib/validation";

const fieldMap = [
  ["Full name", "name"], ["Email", "email"], ["Phone", "phone"], ["College", "college"], ["Degree", "degree"], ["Graduation year", "graduationYear"], ["GitHub", "github"], ["Portfolio", "portfolio"],
] as const;

export async function POST(request: Request) {
  try {
    const { profileId, jobId } = prepareApplicationSchema.parse(await request.json());
    const [profile, job] = await Promise.all([prisma.userProfile.findUnique({ where: { id: profileId } }), prisma.job.findUnique({ where: { id: jobId } })]);
    if (!profile?.confirmedAt) return NextResponse.json({ error: "Confirm the profile before preparing an application" }, { status: 409 });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const values = profile as unknown as Record<string, unknown>;
    const fields = fieldMap.map(([fieldName, profilePath]) => ({ fieldName, profilePath, value: values[profilePath] === undefined || values[profilePath] === null ? null : String(values[profilePath]), confidence: values[profilePath] ? 0.99 : 0, status: values[profilePath] ? "MAPPED" : "NEEDS_USER_INPUT" }));
    const application = await prisma.application.upsert({ where: { jobId }, update: { profileId, applicationUrl: job.applicationUrl, status: "PREPARING" }, create: { profileId, jobId, applicationUrl: job.applicationUrl, status: "PREPARING" }, include: { fields: true } });
    await prisma.applicationField.deleteMany({ where: { applicationId: application.id } });
    await prisma.applicationField.createMany({ data: fields.map((field) => ({ ...field, applicationId: application.id })) });
    await prisma.applicationEvent.create({ data: { applicationId: application.id, eventType: "APPLICATION_PREPARED", message: "Application preview created; no fields have been submitted" } });
    return NextResponse.json({ applicationId: application.id, status: "PREPARING", applicationUrl: job.applicationUrl, job, fields });
  } catch (error) { return errorResponse(error, 400); }
}
