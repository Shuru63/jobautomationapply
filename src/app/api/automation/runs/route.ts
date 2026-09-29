import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { automationRuns, automationEvents } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(automationRuns)
    .where(eq(automationRuns.candidateId, user.profileId));

  const data = await db.query.automationRuns.findMany({
    where: eq(automationRuns.candidateId, user.profileId),
    with: {
      events: {
        orderBy: [desc(automationEvents.createdAt)],
        limit: 10,
      },
    },
    orderBy: [desc(automationRuns.createdAt)],
    limit,
    offset,
  });

  return NextResponse.json({
    runs: data,
    total: totalCount[0]?.count || 0,
    page,
    limit,
    totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, jobSourceId } = body;

  const id = crypto.randomUUID();
  await db.insert(automationRuns).values({
    id,
    candidateId: user.profileId,
    jobSourceId: jobSourceId || null,
    type: type || "job_search",
    status: "pending",
    startedAt: new Date(),
  });

  await db.insert(automationEvents).values({
    id: crypto.randomUUID(),
    runId: id,
    level: "info",
    message: `Automation run started: ${type || "job_search"}`,
  });

  return NextResponse.json({ id }, { status: 201 });
}