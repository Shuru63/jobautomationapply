import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { candidateProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { preferencesSchema } from "@/lib/validation";

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = preferencesSchema.safeParse(body);
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