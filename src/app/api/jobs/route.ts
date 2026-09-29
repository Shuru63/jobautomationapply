import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { jobs, companies, jobMatches, candidateProfiles, skills, experiences, projects } from "@/db/schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { jobSchema } from "@/lib/validation";
import { calculateMatch } from "@/lib/matching";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const remoteType = searchParams.get("remoteType") || "";
  const sortBy = searchParams.get("sortBy") || "created_at";
  const offset = (page - 1) * limit;

  let whereConditions = and(eq(jobs.isActive, true));

  if (status === "saved") {
    whereConditions = and(whereConditions, eq(jobs.isSaved, true));
  } else if (status === "ignored") {
    whereConditions = and(whereConditions, eq(jobs.isIgnored, true));
  } else if (status === "matched") {
    // Handled via join below
  } else {
    whereConditions = and(whereConditions, eq(jobs.isIgnored, false));
  }

  if (search) {
    whereConditions = and(
      whereConditions,
      or(
        ilike(jobs.title, `%${search}%`),
        ilike(jobs.description, `%${search}%`)
      )
    );
  }

  if (remoteType) {
    whereConditions = and(
      whereConditions,
      eq(jobs.remoteType, remoteType as "remote" | "onsite" | "hybrid")
    );
  }

  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(whereConditions);

  const data = await db.query.jobs.findMany({
    where: whereConditions,
    with: {
      company: true,
      matches: {
        where: eq(jobMatches.candidateId, user.profileId),
        limit: 1,
      },
    },
    orderBy: sortBy === "match" ? desc(jobMatches.overallScore) : desc(jobs.createdAt),
    limit,
    offset,
  });

  return NextResponse.json({
    jobs: data,
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
  const parsed = jobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  await db.insert(jobs).values({
    id,
    companyId: parsed.data.companyId || null,
    title: parsed.data.title,
    description: parsed.data.description,
    location: parsed.data.location,
    remoteType: parsed.data.remoteType as "remote" | "onsite" | "hybrid" | undefined,
    employmentType: parsed.data.employmentType as "full_time" | "part_time" | "contract" | "internship" | "freelance" | undefined,
    salaryMin: parsed.data.salaryMin,
    salaryMax: parsed.data.salaryMax,
    salaryCurrency: parsed.data.salaryCurrency ?? "INR",
    requiredSkills: parsed.data.requiredSkills ?? [],
    preferredSkills: parsed.data.preferredSkills ?? [],
    experienceMin: parsed.data.experienceMin,
    experienceMax: parsed.data.experienceMax,
    source: "manual",
    sourceUrl: parsed.data.sourceUrl,
  });

  // Auto-match with current user
  try {
    const profile = await db.query.candidateProfiles.findFirst({
      where: eq(candidateProfiles.id, user.profileId),
    });
    if (profile) {
      const userSkills = await db.query.skills.findMany({
        where: eq(skills.candidateId, user.profileId),
      });
      const userExperiences = await db.query.experiences.findMany({
        where: eq(experiences.candidateId, user.profileId),
      });
      const userProjects = await db.query.projects.findMany({
        where: eq(projects.candidateId, user.profileId),
      });

      const allTechs = [
        ...userSkills.map((s) => s.name),
        ...userExperiences.flatMap((e) => (e.technologies as string[]) || []),
        ...userProjects.flatMap((p) => (p.technologies as string[]) || []),
      ];
      const experienceYears = userExperiences.reduce((acc, exp) => {
        const start = new Date(exp.startDate).getTime();
        const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
        return acc + (end - start) / (365.25 * 24 * 60 * 60 * 1000);
      }, 0);

      const matchResult = calculateMatch(
        {
          skills: userSkills.map((s) => s.name),
          technologies: [...new Set(allTechs)],
          experienceYears: Math.round(experienceYears * 10) / 10,
          targetRoles: (profile.targetRoles as string[]) || [],
          preferredLocations: (profile.preferredLocations as string[]) || [],
          remotePreference: profile.remotePreference,
          expectedSalaryMin: profile.expectedSalaryMin,
          expectedSalaryMax: profile.expectedSalaryMax,
        },
        {
          title: parsed.data.title,
          location: parsed.data.location,
          remoteType: parsed.data.remoteType,
          salaryMin: parsed.data.salaryMin,
          salaryMax: parsed.data.salaryMax,
          experienceMin: parsed.data.experienceMin,
          experienceMax: parsed.data.experienceMax,
          requiredSkills: parsed.data.requiredSkills ?? [],
          preferredSkills: parsed.data.preferredSkills ?? [],
        }
      );

      await db.insert(jobMatches).values({
        id: crypto.randomUUID(),
        candidateId: user.profileId,
        jobId: id,
        overallScore: matchResult.overallScore,
        skillScore: matchResult.skillScore,
        experienceScore: matchResult.experienceScore,
        locationScore: matchResult.locationScore,
        roleScore: matchResult.roleScore,
        technologyScore: matchResult.technologyScore,
        salaryScore: matchResult.salaryScore,
        rating: matchResult.rating,
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills,
        recommendApplication: matchResult.overallScore >= 50,
      });
    }
  } catch (err) {
    console.error("Auto-match error:", err);
  }

  return NextResponse.json({ id }, { status: 201 });
}