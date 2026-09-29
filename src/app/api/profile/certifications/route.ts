import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { certifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { certificationSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await db.query.certifications.findMany({
    where: eq(certifications.candidateId, user.profileId),
  });
  return NextResponse.json({ certifications: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = certificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await db.insert(certifications).values({
    id,
    candidateId: user.profileId,
    name: parsed.data.name,
    issuer: parsed.data.issuer,
    issueDate: parsed.data.issueDate ? new Date(parsed.data.issueDate) : null,
    expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null,
    credentialUrl: parsed.data.credentialUrl,
    credentialId: parsed.data.credentialId,
  });
  return NextResponse.json({ id }, { status: 201 });
}