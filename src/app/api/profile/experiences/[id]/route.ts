import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { experiences } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { experienceSchema } from "@/lib/validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = experienceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  await db
    .update(experiences)
    .set({
      company: parsed.data.company,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      isCurrent: parsed.data.isCurrent ?? false,
      highlights: parsed.data.highlights ?? [],
      technologies: parsed.data.technologies ?? [],
    })
    .where(
      and(eq(experiences.id, id), eq(experiences.candidateId, user.profileId))
    );

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db
    .delete(experiences)
    .where(
      and(eq(experiences.id, id), eq(experiences.candidateId, user.profileId))
    );

  return NextResponse.json({ success: true });
}