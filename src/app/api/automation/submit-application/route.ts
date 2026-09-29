import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { applications, jobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { submitApplication } from "@/lib/browser/application-agent";
import { getBrowserManager } from "@/lib/browser/manager";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { applicationId, approved } = body;

  if (!applicationId) {
    return NextResponse.json({ error: "Application ID required" }, { status: 400 });
  }

  if (!approved) {
    return NextResponse.json({ error: "Application must be approved before submission" }, { status: 400 });
  }

  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.candidateId, user.profileId)
    ),
    with: { job: true },
  });

  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (!app.job?.sourceUrl) {
    return NextResponse.json({ error: "Job URL not found" }, { status: 400 });
  }

  // Check if application is in a submittable state
  if (!["approved", "pending_review"].includes(app.status)) {
    return NextResponse.json(
      { error: `Cannot submit application with status: ${app.status}` },
      { status: 400 }
    );
  }

  try {
    const result = await submitApplication(
      applicationId,
      user.profileId,
      app.job.sourceUrl,
      true
    );

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await getBrowserManager().close().catch(() => {});
  }
}