import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { applications, jobMatches, jobs, resumes } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    statusCounts,
    matchDistribution,
    sourceDistribution,
    topRoles,
    resumePerformance,
  ] = await Promise.all([
    // Application status distribution
    db
      .select({
        status: applications.status,
        count: sql<number>`count(*)`,
      })
      .from(applications)
      .where(eq(applications.candidateId, user.profileId))
      .groupBy(applications.status),

    // Match score distribution
    db
      .select({
        rating: jobMatches.rating,
        count: sql<number>`count(*)`,
      })
      .from(jobMatches)
      .where(eq(jobMatches.candidateId, user.profileId))
      .groupBy(jobMatches.rating),

    // Job source distribution
    db
      .select({
        source: jobs.source,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .where(eq(jobs.isActive, true))
      .groupBy(jobs.source),

    // Top matched roles (from job titles)
    db
      .select({
        title: jobs.title,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .innerJoin(jobMatches, eq(jobs.id, jobMatches.jobId))
      .where(
        and(
          eq(jobMatches.candidateId, user.profileId),
          eq(jobMatches.recommendApplication, true)
        )
      )
      .groupBy(jobs.title)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    // Resume count by template type
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    db
      .select({
        template: resumes.template,
        count: sql<number>`count(*)`,
      })
      .from(resumes)
      .where(eq(resumes.candidateId, user.profileId))
      .groupBy(resumes.template),
  ]);

  return NextResponse.json({
    statusCounts,
    matchDistribution,
    sourceDistribution,
    topRoles,
    resumePerformance,
  });
}