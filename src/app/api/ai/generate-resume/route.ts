import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { candidateProfiles, skills, experiences, education, projects, certifications, languages, jobs, resumes, aiGenerations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateResumeContent } from "@/lib/ai/resume-agent";

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
  const { jobId, template = "job_specific" } = body;

  // Fetch all profile data
  const [profile, userSkills, userExperiences, userEducation, userProjects, userCertifications, userLanguages] =
    await Promise.all([
      db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.id, user.profileId) }),
      db.query.skills.findMany({ where: eq(skills.candidateId, user.profileId) }),
      db.query.experiences.findMany({ where: eq(experiences.candidateId, user.profileId) }),
      db.query.education.findMany({ where: eq(education.candidateId, user.profileId) }),
      db.query.projects.findMany({ where: eq(projects.candidateId, user.profileId) }),
      db.query.certifications.findMany({ where: eq(certifications.candidateId, user.profileId) }),
      db.query.languages.findMany({ where: eq(languages.candidateId, user.profileId) }),
    ]);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch job data if generating job-specific resume
  let jobTarget;
  let job;
  if (jobId) {
    job = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
      with: { company: true },
    });
    if (job) {
      jobTarget = {
        title: job.title,
        company: job.company?.name || "Unknown",
        description: job.description,
        requiredSkills: (job.requiredSkills as string[]) || [],
        preferredSkills: (job.preferredSkills as string[]) || [],
        atsKeywords: [],
      };
    }
  }

  try {
    const content = await generateResumeContent(
      {
        fullName: user.fullName,
        email: user.email,
        phone: profile.phone || undefined,
        city: profile.city || undefined,
        linkedin: profile.linkedinUrl || undefined,
        github: profile.githubUrl || undefined,
        portfolio: profile.portfolioUrl || undefined,
        summary: profile.professionalSummary || undefined,
        experiences: userExperiences.map((e) => ({
          company: e.company,
          title: e.title,
          location: e.location || undefined,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate?.toISOString(),
          isCurrent: e.isCurrent || false,
          highlights: (e.highlights as string[]) || [],
          technologies: (e.technologies as string[]) || [],
        })),
        education: userEducation.map((e) => ({
          institution: e.institution,
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy || undefined,
          startDate: e.startDate?.toISOString(),
          endDate: e.endDate?.toISOString(),
          gpa: e.gpa || undefined,
        })),
        skills: userSkills.map((s) => ({
          name: s.name,
          category: s.category || undefined,
          proficiencyLevel: s.proficiencyLevel || undefined,
        })),
        projects: userProjects.map((p) => ({
          name: p.name,
          description: p.description || undefined,
          url: p.url || undefined,
          technologies: (p.technologies as string[]) || [],
          highlights: (p.highlights as string[]) || [],
        })),
        certifications: userCertifications.map((c) => ({
          name: c.name,
          issuer: c.issuer || undefined,
          date: c.issueDate?.toISOString(),
        })),
        languages: userLanguages.map((l) => ({
          name: l.name,
          level: l.proficiencyLevel || undefined,
        })),
      },
      jobTarget
    );

    // Save resume
    const resumeId = crypto.randomUUID();
    const title = job
      ? `Resume for ${job.title} at ${job.company?.name || "Unknown"}`
      : `Master Resume - ${new Date().toLocaleDateString()}`;

    await db.insert(resumes).values({
      id: resumeId,
      candidateId: user.profileId,
      jobId: jobId || null,
      template: template as "master" | "job_specific" | "role_specific",
      title,
      content,
      isActive: template === "master",
    });

    // Log AI generation
    await db.insert(aiGenerations).values({
      id: crypto.randomUUID(),
      candidateId: user.profileId,
      type: "resume_content",
      jobId: jobId || undefined,
      input: { template, jobId },
      output: { resumeId },
      model: "gemini-2.5-flash",
    });

    return NextResponse.json({ id: resumeId, content, title });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Resume generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}