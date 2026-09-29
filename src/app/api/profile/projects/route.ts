import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { projectSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await db.query.projects.findMany({
    where: eq(projects.candidateId, user.profileId),
    orderBy: [desc(projects.sortOrder)],
  });
  return NextResponse.json({ projects: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await db.insert(projects).values({
    id,
    candidateId: user.profileId,
    name: parsed.data.name,
    description: parsed.data.description,
    url: parsed.data.url,
    repositoryUrl: parsed.data.repositoryUrl,
    technologies: parsed.data.technologies ?? [],
    highlights: parsed.data.highlights ?? [],
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
  });
  return NextResponse.json({ id }, { status: 201 });
}