import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { skills } from "@/db/schema";
import { eq } from "drizzle-orm";
import { skillSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await db.query.skills.findMany({
    where: eq(skills.candidateId, user.profileId),
  });

  return NextResponse.json({ skills: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = skillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  await db.insert(skills).values({
    id,
    candidateId: user.profileId,
    name: parsed.data.name,
    category: parsed.data.category,
    proficiencyLevel: parsed.data.proficiencyLevel ?? 3,
    yearsOfExperience: parsed.data.yearsOfExperience,
    isPrimary: parsed.data.isPrimary ?? false,
  });

  return NextResponse.json({ id }, { status: 201 });
}