import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { candidateProfiles, skills, experiences, education, applications, applicationQuestions, applicationAnswers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { answerApplicationQuestion } from "@/lib/ai/question-agent";

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
  const { applicationId, questionId, question, questionType, maxLength } = body;

  const [profile, userSkills, userExperiences, userEducation] =
    await Promise.all([
      db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.id, user.profileId) }),
      db.query.skills.findMany({ where: eq(skills.candidateId, user.profileId) }),
      db.query.experiences.findMany({ where: eq(experiences.candidateId, user.profileId) }),
      db.query.education.findMany({ where: eq(education.candidateId, user.profileId) }),
    ]);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const experienceYears = userExperiences.reduce((acc, exp) => {
    const start = new Date(exp.startDate).getTime();
    const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
    return acc + (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  }, 0);

  const currentExp = userExperiences.find((e) => e.isCurrent);

  try {
    const result = await answerApplicationQuestion(
      question || "General question",
      questionType || "text",
      maxLength || 500,
      {
        fullName: user.fullName,
        summary: profile.professionalSummary || undefined,
        experienceYears: Math.round(experienceYears * 10) / 10,
        skills: userSkills.map((s) => s.name),
        currentCompany: currentExp?.company,
        currentTitle: currentExp?.title,
        location: profile.city || undefined,
        expectedSalaryMin: profile.expectedSalaryMin || undefined,
        expectedSalaryMax: profile.expectedSalaryMax || undefined,
        education: userEducation.map((e) => `${e.degree} from ${e.institution}`).join(", "),
        highlights: userExperiences.flatMap((e) => (e.highlights as string[]) || []).slice(0, 5),
      }
    );

    // Save answer if questionId provided
    if (questionId && applicationId) {
      const existingAnswer = await db.query.applicationAnswers.findFirst({
        where: and(
          eq(applicationAnswers.questionId, questionId),
          eq(applicationAnswers.applicationId, applicationId)
        ),
      });

      if (existingAnswer) {
        await db
          .update(applicationAnswers)
          .set({
            answerText: result.answer,
            aiGenerated: true,
            updatedAt: new Date(),
          })
          .where(eq(applicationAnswers.id, existingAnswer.id));
      } else {
        await db.insert(applicationAnswers).values({
          id: crypto.randomUUID(),
          questionId,
          applicationId,
          answerText: result.answer,
          aiGenerated: true,
        });
      }
    }

    return NextResponse.json({ answer: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Answer generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}