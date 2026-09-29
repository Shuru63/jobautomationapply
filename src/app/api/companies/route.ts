import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { eq, desc, ilike, sql } from "drizzle-orm";
import { companySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  let whereCondition = undefined;
  if (search) {
    whereCondition = ilike(companies.name, `%${search}%`);
  }

  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(companies)
    .where(whereCondition);

  const data = await db.query.companies.findMany({
    where: whereCondition,
    orderBy: [desc(companies.createdAt)],
    limit,
    offset,
  });

  return NextResponse.json({
    companies: data,
    total: totalCount[0]?.count || 0,
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = companySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await db.insert(companies).values({
    id,
    name: parsed.data.name,
    domain: parsed.data.domain,
    description: parsed.data.description,
    industry: parsed.data.industry,
    size: parsed.data.size,
    location: parsed.data.location,
    websiteUrl: parsed.data.websiteUrl,
    careersUrl: parsed.data.careersUrl,
  });

  return NextResponse.json({ id }, { status: 201 });
}