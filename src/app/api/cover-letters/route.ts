import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { coverLetters } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await db.query.coverLetters.findMany({
    where: eq(coverLetters.candidateId, user.profileId),
    with: {
      job: { with: { company: true } },
    },
    orderBy: [desc(coverLetters.createdAt)],
  });

  return NextResponse.json({ coverLetters: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { jobId, resumeId, title, content } = body;

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await db.insert(coverLetters).values({
    id,
    candidateId: user.profileId,
    jobId: jobId || null,
    resumeId: resumeId || null,
    title: title || "Untitled Cover Letter",
    content,
  });

  return NextResponse.json({ id }, { status: 201 });
}