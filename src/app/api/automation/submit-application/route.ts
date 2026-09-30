import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { applications, candidateProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { submitApplication } from "@/lib/browser/apply-bot";
import { generateResumePDF } from "@/lib/documents/resume-pdf";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { applicationId } = body;

  if (!applicationId) {
    return NextResponse.json({ error: "Application ID required" }, { status: 400 });
  }

  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.candidateId, user.profileId)
    ),
    with: { job: true, resume: true },
  });

  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (!app.job?.sourceUrl) {
    return NextResponse.json({ error: "Job URL not found" }, { status: 400 });
  }

  const profile = await db.query.candidateProfiles.findFirst({
    where: eq(candidateProfiles.id, user.profileId),
  });

  try {
    const pdfBuffer = app.resume?.content 
      ? await generateResumePDF(app.resume.content as any)
      : Buffer.from("");

    const result = await submitApplication({
      applyUrl: app.job.sourceUrl,
      resumeBuffer: pdfBuffer,
      candidateInfo: {
        firstName: user.fullName?.split(" ")[0] || "Candidate",
        lastName: user.fullName?.split(" ").slice(1).join(" ") || "",
        email: user.email || "",
        phone: profile?.phone || "",
        linkedin: profile?.linkedinUrl || "",
        github: profile?.githubUrl || "",
        portfolio: profile?.portfolioUrl || "",
      },
      log: async () => {}, // dummy logger
    });

    if (result.success) {
       await db.update(applications).set({
         status: "submitted",
         appliedAt: new Date(),
       }).where(eq(applications.id, applicationId));
    } else {
       await db.update(applications).set({
         status: "rejected",
         failureReason: result.message,
       }).where(eq(applications.id, applicationId));
    }

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}