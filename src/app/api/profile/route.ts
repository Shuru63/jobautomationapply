import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { candidateProfiles, experiences, education, skills, projects, certifications, languages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { profileSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.query.candidateProfiles.findFirst({
    where: eq(candidateProfiles.id, user.profileId),
    with: {
      experiences: { orderBy: (exp, { desc }) => [desc(exp.sortOrder)] },
      education: { orderBy: (edu, { desc }) => [desc(edu.sortOrder)] },
      skills: { with: {} },
      projects: { orderBy: (p, { desc }) => [desc(p.sortOrder)] },
      certifications: true,
      languages: true,
    },
  });

  return NextResponse.json({ profile, user });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  await db
    .update(candidateProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(candidateProfiles.id, user.profileId));

  return NextResponse.json({ success: true });
}