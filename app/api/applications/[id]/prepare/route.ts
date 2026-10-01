import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { BrowserTool } from "@/lib/browser/tool";
import { errorResponse } from "@/lib/api";
import { withTimeout } from "@/lib/recovery/policy";

const fieldMappings: Array<{ keywords: string[]; profilePath: string }> = [
  { keywords: ["full name", "name", "first name", "last name"], profilePath: "name" },
  { keywords: ["email", "e-mail"], profilePath: "email" },
  { keywords: ["phone", "mobile", "telephone"], profilePath: "phone" },
  { keywords: ["college", "university", "school"], profilePath: "college" },
  { keywords: ["degree"], profilePath: "degree" },
  { keywords: ["graduation", "grad year"], profilePath: "graduationYear" },
  { keywords: ["github"], profilePath: "github" },
  { keywords: ["portfolio", "website"], profilePath: "portfolio" },
];

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const browser = new BrowserTool();
  try {
    const application = await prisma.application.findUnique({ where: { id }, include: { profile: true, job: true } });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (!application.profile.confirmedAt) return NextResponse.json({ error: "Profile confirmation is required" }, { status: 409 });
    const navigation = await withTimeout(browser.navigate(application.applicationUrl), 60_000, "Application page timed out");
    if (!navigation.success) { await prisma.application.update({ where: { id }, data: { status: "FAILED" } }); return NextResponse.json({ error: navigation.output }, { status: 502 }); }
    const formFields = await browser.inspectFormFields();
    const profile = application.profile as unknown as Record<string, unknown>;
    const fields = formFields.map((formField) => { const normalized = formField.label.toLowerCase(); const mapping = fieldMappings.find((candidate) => candidate.keywords.some((keyword) => normalized.includes(keyword))); const value = mapping ? profile[mapping.profilePath] : undefined; return { fieldName: formField.label || formField.selector, profilePath: mapping?.profilePath, value: value === undefined || value === null ? null : String(value), confidence: value !== undefined && value !== null ? 0.99 : 0, status: value !== undefined && value !== null ? "MAPPED" : "NEEDS_USER_INPUT", selector: formField.selector, required: formField.required }; });
    for (const field of fields.filter((field) => field.status === "MAPPED")) await browser.fillField(field.selector, field.value ?? "");
    await prisma.applicationField.deleteMany({ where: { applicationId: id } });
    await prisma.applicationField.createMany({ data: fields.map((field) => ({ applicationId: id, fieldName: field.fieldName, profilePath: field.profilePath, value: field.value, confidence: field.confidence, status: field.status })) });
    const screenshotPath = await browser.screenshot(application.job.id, id);
    await prisma.application.update({ where: { id }, data: { status: "AWAITING_APPROVAL" } });
    await prisma.applicationEvent.create({ data: { applicationId: id, eventType: "FORM_PREPARED", message: `Mapped ${fields.filter((field) => field.status === "MAPPED").length} field(s); final submission remains blocked pending approval`, evidence: { screenshotPath, url: application.applicationUrl } } });
    return NextResponse.json({ status: "AWAITING_APPROVAL", fields, screenshotPath, url: application.applicationUrl });
  } catch (error) { await prisma.application.update({ where: { id }, data: { status: "FAILED" } }).catch(() => undefined); return errorResponse(error, 502); }
  finally { await browser.close().catch(() => undefined); }
}
