import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { automationRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await request.json();
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  // Update status to cancelled
  await db.update(automationRuns)
    .set({ status: "cancelled" })
    .where(and(eq(automationRuns.id, runId), eq(automationRuns.candidateId, user.profileId)));

  return NextResponse.json({ success: true, message: "Pipeline cancelled" });
}
