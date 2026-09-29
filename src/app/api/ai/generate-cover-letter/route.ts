import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { candidateProfiles, skills, experiences, jobs, coverLetters, resumes, aiGenerations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateCoverLetter } from "@/lib/ai/cover-letter-agent";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { jobId, resumeId } = body;

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  const [profile, userSkills, userExperiences, job] = await Promise.all([
    db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.id, user.profileId) }),
    db.query.skills.findMany({ where: eq(skills.candidateId, user.profileId) }),
    db.query.experiences.findMany({ where: eq(experiences.candidateId, user.profileId) }),
    db.query.jobs.findFirst({ where: eq(jobs.id, jobId), with: { company: true } }),
  ]);

  if (!profile || !job) {
    return NextResponse.json({ error: "Profile or job not found" }, { status: 404 });
  }

  const experienceYears = userExperiences.reduce((acc, exp) => {
    const start = new Date(exp.startDate).getTime();
    const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
    return acc + (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  }, 0);

  const resumeHighlights = resumeId
    ? (await db.query.resumes.findFirst({ where: eq(resumes.id, resumeId) }))?.content?.experience?.flatMap((e) => e.highlights) || []
    : [];

  try {
    const content = await generateCoverLetter(
      {
        fullName: user.fullName,
        summary: profile.professionalSummary || undefined,
        experienceYears: Math.round(experienceYears * 10) / 10,
        keySkills: userSkills.map((s) => s.name).slice(0, 10),
        targetRole: job.title,
        highlights: userExperiences
          .flatMap((e) => (e.highlights as string[]) || [])
          .slice(0, 5),
      },
      {
        title: job.title,
        company: job.company?.name || "Unknown",
        description: job.description,
        location: job.location || undefined,
      },
      resumeHighlights as string[]
    );

    // Save cover letter
    const id = crypto.randomUUID();
    await db.insert(coverLetters).values({
      id,
      candidateId: user.profileId,
      jobId,
      resumeId: resumeId || null,
      title: `Cover Letter for ${job.title} at ${job.company?.name || "Unknown"}`,
      content,
    });

    // Log AI generation
    await db.insert(aiGenerations).values({
      id: crypto.randomUUID(),
      candidateId: user.profileId,
      type: "cover_letter",
      jobId,
      input: { jobId, resumeId },
      output: { coverLetterId: id },
      model: "gemini-2.5-flash",
    });

    return NextResponse.json({ id, content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cover letter generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}