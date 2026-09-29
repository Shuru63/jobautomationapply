import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { jobs, jobMatches, applications, interviews, resumes } from "@/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalJobs,
    matchedJobs,
    savedJobs,
    totalApplications,
    pendingApplications,
    submittedApplications,
    interviewApplications,
    offerApplications,
    rejectedApplications,
    todayApplications,
    totalResumes,
    recentApplications,
    topMatches,
  ] = await Promise.all([
    // Total active jobs
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.isActive, true)),
    // Matched jobs (score >= 50)
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobMatches)
      .where(
        and(
          eq(jobMatches.candidateId, user.profileId),
          gte(jobMatches.overallScore, 50)
        )
      ),
    // Saved jobs
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(and(eq(jobs.isSaved, true), eq(jobs.isActive, true))),
    // Total applications
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(eq(applications.candidateId, user.profileId)),
    // Pending review
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(
        and(
          eq(applications.candidateId, user.profileId),
          eq(applications.status, "pending_review")
        )
      ),
    // Submitted
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(
        and(
          eq(applications.candidateId, user.profileId),
          eq(applications.status, "submitted")
        )
      ),
    // Interviews
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(
        and(
          eq(applications.candidateId, user.profileId),
          eq(applications.status, "interview")
        )
      ),
    // Offers
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(
        and(
          eq(applications.candidateId, user.profileId),
          eq(applications.status, "offer")
        )
      ),
    // Rejected
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(
        and(
          eq(applications.candidateId, user.profileId),
          eq(applications.status, "rejected")
        )
      ),
    // Today's applications
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(
        and(
          eq(applications.candidateId, user.profileId),
          gte(applications.createdAt, today)
        )
      ),
    // Total resumes
    db
      .select({ count: sql<number>`count(*)` })
      .from(resumes)
      .where(eq(resumes.candidateId, user.profileId)),
    // Recent applications
    db.query.applications.findMany({
      where: eq(applications.candidateId, user.profileId),
      with: {
        job: { with: { company: true } },
      },
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      limit: 5,
    }),
    // Top matches
    db.query.jobMatches.findMany({
      where: eq(jobMatches.candidateId, user.profileId),
      with: {
        job: { with: { company: true } },
      },
      orderBy: (m, { desc }) => [desc(m.overallScore)],
      limit: 5,
    }),
  ]);

  return NextResponse.json({
    stats: {
      totalJobs: totalJobs[0]?.count || 0,
      matchedJobs: matchedJobs[0]?.count || 0,
      savedJobs: savedJobs[0]?.count || 0,
      totalApplications: totalApplications[0]?.count || 0,
      pendingApplications: pendingApplications[0]?.count || 0,
      submittedApplications: submittedApplications[0]?.count || 0,
      interviewApplications: interviewApplications[0]?.count || 0,
      offerApplications: offerApplications[0]?.count || 0,
      rejectedApplications: rejectedApplications[0]?.count || 0,
      todayApplications: todayApplications[0]?.count || 0,
      totalResumes: totalResumes[0]?.count || 0,
    },
    recentApplications,
    topMatches,
  });
}