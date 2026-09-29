import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { candidateProfiles, skills, experiences, education, projects, jobs, jobMatches, aiGenerations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { analyzeJobMatch } from "@/lib/ai/job-agent";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { jobId } = body;

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  // Fetch profile data
  const profile = await db.query.candidateProfiles.findFirst({
    where: eq(candidateProfiles.id, user.profileId),
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const [userSkills, userExperiences, userEducation, userProjects, job] =
    await Promise.all([
      db.query.skills.findMany({ where: eq(skills.candidateId, user.profileId) }),
      db.query.experiences.findMany({ where: eq(experiences.candidateId, user.profileId) }),
      db.query.education.findMany({ where: eq(education.candidateId, user.profileId) }),
      db.query.projects.findMany({ where: eq(projects.candidateId, user.profileId) }),
      db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
        with: { company: true },
      }),
    ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Calculate experience years
  const experienceYears = userExperiences.reduce((acc, exp) => {
    const start = new Date(exp.startDate).getTime();
    const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
    return acc + (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  }, 0);

  const allTechs = [
    ...userSkills.map((s) => s.name),
    ...userExperiences.flatMap((e) => (e.technologies as string[]) || []),
    ...userProjects.flatMap((p) => (p.technologies as string[]) || []),
  ];

  try {
    const result = await analyzeJobMatch(
      {
        fullName: user.fullName,
        headline: profile.headline || undefined,
        summary: profile.professionalSummary || undefined,
        skills: userSkills.map((s) => s.name),
        experienceYears: Math.round(experienceYears * 10) / 10,
        experienceSummary: userExperiences
          .map((e) => `${e.title} at ${e.company} (${e.description || "N/A"})`)
          .join("; "),
        technologies: [...new Set(allTechs)],
        targetRoles: (profile.targetRoles as string[]) || [],
        preferredLocations: (profile.preferredLocations as string[]) || [],
        remotePreference: profile.remotePreference || undefined,
        expectedSalaryMin: profile.expectedSalaryMin || undefined,
        expectedSalaryMax: profile.expectedSalaryMax || undefined,
        educationSummary: userEducation
          .map((e) => `${e.degree} in ${e.fieldOfStudy || "N/A"} from ${e.institution}`)
          .join("; "),
      },
      {
        title: job.title,
        company: job.company?.name || "Unknown",
        description: job.description,
        location: job.location || undefined,
        remoteType: job.remoteType || undefined,
        salaryMin: job.salaryMin || undefined,
        salaryMax: job.salaryMax || undefined,
        experienceMin: job.experienceMin || undefined,
        experienceMax: job.experienceMax || undefined,
        requiredSkills: (job.requiredSkills as string[]) || [],
        preferredSkills: (job.preferredSkills as string[]) || [],
      }
    );

    // Upsert match
    const existingMatch = await db.query.jobMatches.findFirst({
      where: (matches, { and, eq: eqFn }) =>
        and(eqFn(matches.candidateId, user.profileId!), eqFn(matches.jobId, jobId)),
    });

    const matchData = {
      overallScore: result.matchScore,
      skillScore: result.matchedSkills.length * 10,
      experienceScore: result.experienceMatch ? 100 : 30,
      locationScore: result.locationMatch ? 100 : 30,
      roleScore: result.matchScore,
      technologyScore: result.matchedSkills.length * 10,
      salaryScore: 50,
      rating: result.rating,
      matchedSkills: result.matchedSkills,
      missingSkills: result.missingSkills,
      atsKeywords: result.atsKeywords,
      reasoning: result.reasoning,
      strengthsAndWeaknesses: result.strengthsAndWeaknesses,
      recommendApplication: result.recommendApplication,
      analyzedAt: new Date(),
    };

    if (existingMatch) {
      await db
        .update(jobMatches)
        .set(matchData)
        .where(eq(jobMatches.id, existingMatch.id));
    } else {
      await db.insert(jobMatches).values({
        id: crypto.randomUUID(),
        candidateId: user.profileId,
        jobId,
        ...matchData,
      });
    }

    // Log AI generation
    await db.insert(aiGenerations).values({
      id: crypto.randomUUID(),
      candidateId: user.profileId,
      type: "job_analysis",
      jobId,
      input: { candidateProfile: user.fullName, jobTitle: job.title },
      output: result,
      model: "gemini-2.5-flash",
    });

    return NextResponse.json({ match: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}