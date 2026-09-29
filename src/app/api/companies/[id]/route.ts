import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, id),
    with: {
      jobs: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({ company });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name) updateData.name = body.name;
  if (body.domain !== undefined) updateData.domain = body.domain;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.industry !== undefined) updateData.industry = body.industry;
  if (body.size !== undefined) updateData.size = body.size;
  if (body.location !== undefined) updateData.location = body.location;
  if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl;
  if (body.careersUrl !== undefined) updateData.careersUrl = body.careersUrl;
  if (body.notes !== undefined) updateData.notes = body.notes;

  await db.update(companies).set(updateData).where(eq(companies.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db.delete(companies).where(eq(companies.id, id));
  return NextResponse.json({ success: true });
}