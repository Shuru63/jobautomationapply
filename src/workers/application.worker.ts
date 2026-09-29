import type { Job } from "bullmq";
import { createWorker, updateRunStatus, logRunEvent } from "./base-worker";
import type { ApplicationJobData, ApplicationSubmitJobData } from "@/lib/queues";
import { db } from "@/db";
import { applications, candidateProfiles, skills, experiences, education, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { prepareAndFillApplication, submitApplication } from "@/lib/browser/application-agent";
import { getBrowserManager } from "@/lib/browser/manager";

export function startApplicationWorker() {
  return createWorker<ApplicationJobData>("application-preparation", async (job) => {
    const { candidateId, applicationId, jobId, runId } = job.data;

    if (runId) await updateRunStatus(runId, "running");

    try {
      const [profile, app, jobData, userSkills, userExperiences, userEducation] = await Promise.all([
        db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.id, candidateId) }),
        db.query.applications.findFirst({ where: eq(applications.id, applicationId) }),
        db.query.jobs.findFirst({ where: eq(jobs.id, jobId), with: { company: true } }),
        db.query.skills.findMany({ where: eq(skills.candidateId, candidateId) }),
        db.query.experiences.findMany({ where: eq(experiences.candidateId, candidateId) }),
        db.query.education.findMany({ where: eq(education.candidateId, candidateId) }),
      ]);

      if (!profile || !app || !jobData) {
        throw new Error("Missing profile, application, or job data");
      }

      // Get user info
      const user = await db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, profile.userId),
      });
      if (!user) throw new Error("User not found");

      const experienceYears = userExperiences.reduce((acc, exp) => {
        const start = new Date(exp.startDate).getTime();
        const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
        return acc + (end - start) / (365.25 * 24 * 60 * 60 * 1000);
      }, 0);

      const currentExp = userExperiences.find((e) => e.isCurrent);
      const result = await prepareAndFillApplication(
        applicationId,
        candidateId,
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
        jobData.sourceUrl || "",
        undefined // resume file path
      );

      if (runId) {
        await logRunEvent(runId, "info", `Application ${applicationId}: ${result.status}`);
        const existingRun = await db.query.automationRuns.findFirst({
          where: (r, { eq: eqFn }) => eqFn(r.id, runId),
        });
        const runResult = (existingRun?.result || {}) as Record<string, unknown>;
        runResult.applicationsPrepared = ((runResult.applicationsPrepared as number) || 0) + 1;
        await updateRunStatus(runId, "running", runResult);
      }

      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Application preparation failed";
      if (runId) {
        await logRunEvent(runId, "error", msg);
      }
      throw err;
    } finally {
      await getBrowserManager().close().catch(() => {});
    }
  });
}

export function startApplicationSubmitWorker() {
  return createWorker<ApplicationSubmitJobData>("application-submission", async (job) => {
    const { candidateId, applicationId, runId, approvedByUser } = job.data;

    if (!approvedByUser) {
      if (runId) await logRunEvent(runId, "warn", "Submission skipped - not approved by user");
      return;
    }

    try {
      const app = await db.query.applications.findFirst({
        where: eq(applications.id, applicationId),
        with: { job: true },
      });
      if (!app || !app.job?.sourceUrl) throw new Error("Application or job URL not found");

      const result = await submitApplication(
        applicationId,
        candidateId,
        app.job.sourceUrl,
        true
      );

      if (runId) {
        await logRunEvent(runId, result.success ? "info" : "error", `Submission result: ${result.status}`);
        if (result.success) {
          const existingRun = await db.query.automationRuns.findFirst({
            where: (r, { eq: eqFn }) => eqFn(r.id, runId),
          });
          const runResult = (existingRun?.result || {}) as Record<string, unknown>;
          runResult.applicationsSubmitted = ((runResult.applicationsSubmitted as number) || 0) + 1;
          await updateRunStatus(runId, "running", runResult);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      if (runId) await logRunEvent(runId, "error", msg);
      throw err;
    } finally {
      await getBrowserManager().close().catch(() => {});
    }
  });
}

