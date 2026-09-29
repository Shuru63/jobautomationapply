import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { candidateProfiles, skills, experiences, education, projects, applications, interviews, interviewPreparations, aiGenerations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateInterviewPrep } from "@/lib/ai/interview-agent";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { interviewId, applicationId, roundType } = body;

  if (!interviewId || !applicationId) {
    return NextResponse.json({ error: "Interview and application IDs required" }, { status: 400 });
  }

  // Verify ownership
  const interview = await db.query.interviews.findFirst({
    where: eq(interviews.id, interviewId),
    with: {
      application: {
        with: { job: { with: { company: true } } },
      },
    },
  });

  if (!interview || interview.application?.candidateId !== user.profileId) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const [profile, userSkills, userExperiences, userEducation, userProjects] = await Promise.all([
    db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.id, user.profileId) }),
    db.query.skills.findMany({ where: eq(skills.candidateId, user.profileId) }),
    db.query.experiences.findMany({ where: eq(experiences.candidateId, user.profileId) }),
    db.query.education.findMany({ where: eq(education.candidateId, user.profileId) }),
    db.query.projects.findMany({ where: eq(projects.candidateId, user.profileId) }),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const job = interview.application.job;

  const experienceYears = userExperiences.reduce((acc, exp) => {
    const start = new Date(exp.startDate).getTime();
    const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
    return acc + (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  }, 0);

  try {
    const result = await generateInterviewPrep(
      {
        fullName: user.fullName,
        summary: profile.professionalSummary || undefined,
        skills: userSkills.map((s) => s.name),
        experienceYears: Math.round(experienceYears * 10) / 10,
        experienceSummary: userExperiences.map((e) => `${e.title} at ${e.company}`).join("; "),
        projects: userProjects.map((p) => `${p.name}: ${p.description || ""}`).join("; "),
        education: userEducation.map((e) => `${e.degree} from ${e.institution}`).join(", "),
      },
      {
        title: job.title,
        company: job.company?.name || "Unknown",
        description: job.description,
        requiredSkills: (job.requiredSkills as string[]) || [],
        location: job.location || undefined,
      },
      roundType || interview.roundType || "general"
    );

    // Save preparation
    const existingPrep = await db.query.interviewPreparations.findFirst({
      where: eq(interviewPreparations.interviewId, interviewId),
    });

    const prepData = {
      companyResearch: result.companyResearch,
      roleAnalysis: result.roleAnalysis,
      technicalTopics: result.technicalTopics,
      behavioralQuestions: result.behavioralQuestions,
      technicalQuestions: result.technicalQuestions,
      projectQuestions: result.projectQuestions,
      questionsToAsk: result.questionsToAsk,
      resumeTopics: result.resumeTopics,
    };

    if (existingPrep) {
      await db.update(interviewPreparations)
        .set({ ...prepData, updatedAt: new Date() })
        .where(eq(interviewPreparations.id, existingPrep.id));
    } else {
      await db.insert(interviewPreparations).values({
        id: crypto.randomUUID(),
        interviewId,
        ...prepData,
      });
    }

    // Log AI generation
    await db.insert(aiGenerations).values({
      id: crypto.randomUUID(),
      candidateId: user.profileId,
      type: "interview_prep",
      jobId: job.id,
      input: { interviewId, roundType },
      output: { interviewPrepId: existingPrep?.id || "new" },
      model: "gemini-2.5-flash",
    });

    return NextResponse.json({ prep: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Interview prep generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}