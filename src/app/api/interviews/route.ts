import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { interviews, applications } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await db.query.interviews.findMany({
    with: {
      application: {
        with: {
          job: { with: { company: true } },
        },
      },
      preparation: true,
    },
    orderBy: [desc(interviews.scheduledAt)],
  });

  // Filter to only this user's interviews
  const userInterviews = data.filter(
    (i) => i.application?.candidateId === user.profileId
  );

  return NextResponse.json({ interviews: userInterviews });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { applicationId, roundType, scheduledAt, durationMinutes, location, meetingUrl, interviewerName, interviewerEmail } = body;

  if (!applicationId) {
    return NextResponse.json({ error: "Application ID is required" }, { status: 400 });
  }

  // Verify ownership
  const application = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.candidateId, user.profileId)
    ),
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const id = crypto.randomUUID();
  await db.insert(interviews).values({
    id,
    applicationId,
    roundNumber: 1,
    roundType,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    durationMinutes,
    location,
    meetingUrl,
    interviewerName,
    interviewerEmail,
    status: "scheduled",
  });

  // Update application status
  await db
    .update(applications)
    .set({ status: "interview", updatedAt: new Date() })
    .where(eq(applications.id, applicationId));

  return NextResponse.json({ id }, { status: 201 });
}