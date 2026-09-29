import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId") || "";

  let whereCondition = eq(resumes.candidateId, user.profileId);

  const data = await db.query.resumes.findMany({
    where: whereCondition,
    with: {
      job: { with: { company: true } },
    },
    orderBy: [desc(resumes.createdAt)],
  });

  return NextResponse.json({ resumes: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { jobId, template, title, content } = body;

  const id = crypto.randomUUID();
  await db.insert(resumes).values({
    id,
    candidateId: user.profileId,
    jobId: jobId || null,
    template: template || "master",
    title: title || "Untitled Resume",
    content,
    isActive: !jobId, // Master resumes are active by default
  });

  return NextResponse.json({ id }, { status: 201 });
}