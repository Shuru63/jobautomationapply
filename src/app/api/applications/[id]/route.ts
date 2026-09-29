import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { applications, applicationEvents, applicationQuestions, applicationAnswers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const application = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, id),
      eq(applications.candidateId, user.profileId)
    ),
    with: {
      job: { with: { company: true } },
      resume: true,
      coverLetter: true,
      questions: {
        with: { answers: true },
        orderBy: (q, { asc }) => [asc(q.sortOrder)],
      },
      events: {
        orderBy: [desc(applicationEvents.createdAt)],
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({ application });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Verify ownership
  const existing = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, id),
      eq(applications.candidateId, user.profileId)
    ),
  });

  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.status) {
    updateData.status = body.status;
    if (body.status === "submitted") {
      updateData.appliedAt = new Date();
    }
  }
  if (body.resumeId) updateData.resumeId = body.resumeId;
  if (body.coverLetterId) updateData.coverLetterId = body.coverLetterId;
  if (body.formFields) updateData.formFields = body.formFields;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.failureReason !== undefined) updateData.failureReason = body.failureReason;

  await db.update(applications).set(updateData).where(eq(applications.id, id));

  // Log status change event
  if (body.status && body.status !== existing.status) {
    await db.insert(applicationEvents).values({
      id: crypto.randomUUID(),
      applicationId: id,
      eventType: "status_change",
      description: `Status changed from ${existing.status} to ${body.status}`,
      metadata: { from: existing.status, to: body.status },
    });
  }

  return NextResponse.json({ success: true });
}