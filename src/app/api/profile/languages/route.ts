import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { languages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { languageSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await db.query.languages.findMany({
    where: eq(languages.candidateId, user.profileId),
  });
  return NextResponse.json({ languages: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = languageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await db.insert(languages).values({
    id,
    candidateId: user.profileId,
    name: parsed.data.name,
    proficiencyLevel: parsed.data.proficiencyLevel,
  });
  return NextResponse.json({ id }, { status: 201 });
}