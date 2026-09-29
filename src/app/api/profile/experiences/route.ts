import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { experiences } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { experienceSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await db.query.experiences.findMany({
    where: eq(experiences.candidateId, user.profileId),
    orderBy: [desc(experiences.sortOrder)],
  });

  return NextResponse.json({ experiences: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = experienceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  await db.insert(experiences).values({
    id,
    candidateId: user.profileId,
    company: parsed.data.company,
    title: parsed.data.title,
    description: parsed.data.description,
    location: parsed.data.location,
    startDate: new Date(parsed.data.startDate),
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    isCurrent: parsed.data.isCurrent ?? false,
    highlights: parsed.data.highlights ?? [],
    technologies: parsed.data.technologies ?? [],
  });

  return NextResponse.json({ id }, { status: 201 });
}