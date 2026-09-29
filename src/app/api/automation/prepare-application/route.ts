import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { applications, candidateProfiles, skills, experiences, education, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { prepareAndFillApplication } from "@/lib/browser/application-agent";
import { getBrowserManager } from "@/lib/browser/manager";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { applicationId } = body;

  if (!applicationId) {
    return NextResponse.json({ error: "Application ID required" }, { status: 400 });
  }

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: { job: true },
  });

  if (!app || app.candidateId !== user.profileId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (!app.job?.sourceUrl) {
    return NextResponse.json({ error: "Job URL not found. Add a source URL to the job first." }, { status: 400 });
  }

  try {
    const [profile, userSkills, userExperiences, userEducation] = await Promise.all([
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

    const result = await prepareAndFillApplication(
      applicationId,
      user.profileId,
      {
        fullName: user.fullName,
        email: user.email,
        phone: profile.phone || undefined,
        city: profile.city || undefined,
        linkedin: profile.linkedinUrl || undefined,
        github: profile.githubUrl || undefined,
        portfolio: profile.portfolioUrl || undefined,
        summary: profile.professionalSummary || undefined,
        experienceYears,
        currentTitle: currentExp?.title,
        currentCompany: currentExp?.company,
        expectedSalary: profile.expectedSalaryMin || undefined,
        skills: userSkills.map((s) => s.name),
        education: userEducation.map((e) => `${e.degree} from ${e.institution}`).join(", "),
        highlights: userExperiences.flatMap((e) => (e.highlights as string[]) || []).slice(0, 5),
      },
      app.job.sourceUrl
    );

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Automation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await getBrowserManager().close().catch(() => {});
  }
}