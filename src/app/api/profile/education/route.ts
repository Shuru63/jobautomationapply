import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { education } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { educationSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await db.query.education.findMany({
    where: eq(education.candidateId, user.profileId),
    orderBy: [desc(education.sortOrder)],
  });

  return NextResponse.json({ education: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = educationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  await db.insert(education).values({
    id,
    candidateId: user.profileId,
    institution: parsed.data.institution,
    degree: parsed.data.degree,
    fieldOfStudy: parsed.data.fieldOfStudy,
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    gpa: parsed.data.gpa,
    description: parsed.data.description,
  });

  return NextResponse.json({ id }, { status: 201 });
}