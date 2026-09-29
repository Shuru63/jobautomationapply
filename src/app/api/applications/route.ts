import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { applications, jobs, companies, resumes, coverLetters, applicationEvents } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  let whereConditions = eq(applications.candidateId, user.profileId);

  if (status && status !== "all") {
    whereConditions = and(
      whereConditions,
      eq(
        applications.status,
        status as
          | "draft"
          | "pending_review"
          | "approved"
          | "submitted"
          | "viewed"
          | "interview"
          | "offer"
          | "rejected"
          | "withdrawn"
          | "accepted"
      )
    )!;
  }

  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(whereConditions);

  const data = await db.query.applications.findMany({
    where: whereConditions,
    with: {
      job: {
        with: { company: true },
      },
      resume: true,
      coverLetter: true,
    },
    orderBy: [desc(applications.createdAt)],
    limit,
    offset,
  });

  return NextResponse.json({
    applications: data,
    total: totalCount[0]?.count || 0,
    page,
    limit,
    totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { jobId, resumeId, coverLetterId } = body;

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  // Check for duplicate
  const existing = await db.query.applications.findFirst({
    where: and(
      eq(applications.candidateId, user.profileId),
      eq(applications.jobId, jobId)
    ),
  });

  if (existing) {
    return NextResponse.json(
      { error: "Application already exists for this job" },
      { status: 409 }
    );
  }

  const id = crypto.randomUUID();
  await db.insert(applications).values({
    id,
    candidateId: user.profileId,
    jobId,
    resumeId: resumeId || null,
    coverLetterId: coverLetterId || null,
    status: "draft",
  });

  // Add initial event
  await db.insert(applicationEvents).values({
    id: crypto.randomUUID(),
    applicationId: id,
    eventType: "created",
    description: "Application created",
  });

  return NextResponse.json({ id }, { status: 201 });
}