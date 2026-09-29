import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { jobs, jobMatches } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, id),
    with: {
      company: true,
      matches: {
        where: eq(jobMatches.candidateId, user.profileId),
        limit: 1,
      },
      applications: {
        where: eq(jobs.id, id),
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.isSaved !== undefined) updateData.isSaved = body.isSaved;
  if (body.isIgnored !== undefined) updateData.isIgnored = body.isIgnored;
  if (body.ignoreReason !== undefined) updateData.ignoreReason = body.ignoreReason;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  updateData.updatedAt = new Date();

  await db.update(jobs).set(updateData).where(eq(jobs.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db.delete(jobs).where(eq(jobs.id, id));
  return NextResponse.json({ success: true });
}