import type { Job } from "bullmq";
import { createWorker, updateRunStatus, logRunEvent } from "./base-worker";
import type { ResumeGenJobData } from "@/lib/queues";
import { db } from "@/db";
import { candidateProfiles, skills, experiences, education, projects, certifications, languages, jobs, resumes, aiGenerations, automationRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateResumeContent } from "@/lib/ai/resume-agent";

export function startResumeWorker() {
  return createWorker<ResumeGenJobData>("resume-generation", async (job) => {
    const { candidateId, jobId, template, runId } = job.data;

    if (runId) await updateRunStatus(runId, "running");

    try {
      const [profile, userSkills, userExperiences, userEducation, userProjects, userCertifications, userLanguages] =
        await Promise.all([
          db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.id, candidateId) }),
          db.query.skills.findMany({ where: eq(skills.candidateId, candidateId) }),
          db.query.experiences.findMany({ where: eq(experiences.candidateId, candidateId) }),
          db.query.education.findMany({ where: eq(education.candidateId, candidateId) }),
          db.query.projects.findMany({ where: eq(projects.candidateId, candidateId) }),
          db.query.certifications.findMany({ where: eq(certifications.candidateId, candidateId) }),
          db.query.languages.findMany({ where: eq(languages.candidateId, candidateId) }),
        ]);

      if (!profile) throw new Error("Profile not found");

      const jobData = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
        with: { company: true },
      });

      let jobTarget;
      if (jobData) {
        jobTarget = {
          title: jobData.title,
          company: jobData.company?.name || "Unknown",
          description: jobData.description,
          requiredSkills: (jobData.requiredSkills as string[]) || [],
          preferredSkills: (jobData.preferredSkills as string[]) || [],
          atsKeywords: [],
        };
      }

      // Get user info
      const user = await db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, profile.userId),
      });

      if (!user) throw new Error("User not found");

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

      const resumeId = crypto.randomUUID();
      const title = jobData
        ? `Resume for ${jobData.title} at ${jobData.company?.name || "Unknown"}`
        : `Master Resume - ${new Date().toLocaleDateString()}`;

      await db.insert(resumes).values({
        id: resumeId,
        candidateId,
        jobId: jobId || null,
        template,
        title,
        content,
        isActive: template === "master",
      });

      await db.insert(aiGenerations).values({
        id: crypto.randomUUID(),
        candidateId,
        type: "resume_content",
        jobId,
        input: { template },
        output: { resumeId },
        model: "gemini-2.5-flash",
      });

      if (runId) {
        await logRunEvent(runId, "info", `Resume generated: ${title}`);
        // Update run result with resume count
        const existingRun = await db.query.automationRuns.findFirst({
          where: (r, { eq: eqFn }) => eqFn(r.id, runId),
        });
        const result = (existingRun?.result || {}) as Record<string, unknown>;
        result.resumesGenerated = ((result.resumesGenerated as number) || 0) + 1;
        await updateRunStatus(runId, "running", result);
      }

      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Resume generation failed";
      if (runId) {
        await logRunEvent(runId, "error", msg);
        await updateRunStatus(runId, "failed", undefined, msg);
      }
      throw err;
    }
  });
}