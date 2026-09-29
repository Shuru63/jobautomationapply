import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { jobSources } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await db.query.jobSources.findMany({
    orderBy: [desc(jobSources.createdAt)],
  });

  return NextResponse.json({ sources: data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, type, url, config } = body;

  if (!name || !type || !url) {
    return NextResponse.json(
      { error: "Name, type, and URL are required" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  await db.insert(jobSources).values({
    id,
    name,
    type,
    url,
    config: config || {},
  });

  return NextResponse.json({ id }, { status: 201 });
}