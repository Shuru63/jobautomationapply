import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { automationRuns, automationEvents } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const run = await db.query.automationRuns.findFirst({
    where: and(
      eq(automationRuns.id, id),
      eq(automationRuns.candidateId, user.profileId)
    ),
    with: {
      events: {
        orderBy: [desc(automationEvents.createdAt)],
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.status) {
    updateData.status = body.status;
    if (body.status === "completed" || body.status === "failed") {
      updateData.completedAt = new Date();
    }
  }
  if (body.result) updateData.result = body.result;
  if (body.error) updateData.error = body.error;

  await db
    .update(automationRuns)
    .set(updateData)
    .where(
      and(eq(automationRuns.id, id), eq(automationRuns.candidateId, user.profileId))
    );

  // Log event
  if (body.eventMessage) {
    await db.insert(automationEvents).values({
      id: crypto.randomUUID(),
      runId: id,
      level: body.eventLevel || "info",
      message: body.eventMessage,
      details: body.eventDetails || {},
    });
  }

  return NextResponse.json({ success: true });
}