import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { BrowserTool } from "@/lib/browser/tool";
import { errorResponse } from "@/lib/api";
import { verifyExpectedOutcome } from "@/lib/verification/verify";
import { withTimeout } from "@/lib/recovery/policy";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const browser = new BrowserTool();
  try {
    const application = await prisma.application.findUnique({ where: { id }, include: { job: true, fields: true } });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (application.status !== "AWAITING_APPROVAL") return NextResponse.json({ error: "Application is not awaiting explicit approval" }, { status: 409 });
    if (application.fields.some((field) => field.status === "NEEDS_USER_INPUT")) return NextResponse.json({ error: "Application still has fields requiring user input" }, { status: 409 });
    const navigation = await withTimeout(browser.navigate(application.applicationUrl), 60_000, "Application page timed out");
    if (!navigation.success) return NextResponse.json({ error: navigation.output }, { status: 502 });
    const click = await browser.click('button[type="submit"], input[type="submit"], button:has-text("Submit")');
    const observation = await browser.observe(application.job.id, id);
    const verification = verifyExpectedOutcome("application submitted confirmation thank you", `${click.output}\n${observation.text}`);
    const status = click.success && verification.verified ? "VERIFIED" : "UNKNOWN";
    await prisma.application.update({ where: { id }, data: { status, submittedAt: click.success ? new Date() : null, verifiedAt: status === "VERIFIED" ? new Date() : null, confirmationId: status === "VERIFIED" ? observation.url : null } });
    await prisma.applicationEvent.create({ data: { applicationId: id, eventType: status === "VERIFIED" ? "SUBMISSION_VERIFIED" : "SUBMISSION_UNCERTAIN", message: verification.summary, evidence: { screenshotPath: observation.screenshotPath, url: observation.url, confidence: verification.confidence } } });
    return NextResponse.json({ status, verified: status === "VERIFIED", evidence: observation, verification });
  } catch (error) { await prisma.application.update({ where: { id }, data: { status: "UNKNOWN" } }).catch(() => undefined); return errorResponse(error, 502); }
  finally { await browser.close().catch(() => undefined); }
}
