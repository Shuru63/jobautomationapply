import type { Job } from "bullmq";
import { createWorker, updateRunStatus, logRunEvent } from "./base-worker";
import type { JobSearchJobData } from "@/lib/queues";
import { createScraper } from "@/lib/browser/career-agent";
import { db } from "@/db";
import { jobs, companies, jobSources, candidateProfiles, skills, experiences, projects, jobMatches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateMatch } from "@/lib/matching";

export function startJobSearchWorker() {
  return createWorker<JobSearchJobData>("job-search", async (job) => {
    const { candidateId, sourceId, runId } = job.data;

    await updateRunStatus(runId, "running");
    await logRunEvent(runId, "info", "Job search started");

    let totalFound = 0;
    let totalDuplicates = 0;
    let totalSaved = 0;
    let totalMatched = 0;

    try {
      // Get sources to scan
      const sourceConditions = sourceId
        ? eq(jobSources.id, sourceId)
        : eq(jobSources.isActive, true);

      const sources = await db.query.jobSources.findMany({
        where: sourceConditions,
      });

      // Also fetch the candidate profile for matching
      const profile = await db.query.candidateProfiles.findFirst({
        where: eq(candidateProfiles.id, candidateId),
      });

      const userSkills = await db.query.skills.findMany({
        where: eq(skills.candidateId, candidateId),
      });
      const userExperiences = await db.query.experiences.findMany({
        where: eq(experiences.candidateId, candidateId),
      });
      const userProjects = await db.query.projects.findMany({
        where: eq(projects.candidateId, candidateId),
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

      for (const source of sources) {
        try {
          await logRunEvent(runId, "info", `Scanning source: ${source.name} (${source.type})`);

          const scraper = createScraper(source.type);
          const scrapedJobs = await scraper.scrapeJobs(source.url);
          totalFound += scrapedJobs.length;

          await logRunEvent(runId, "info", `Found ${scrapedJobs.length} jobs from ${source.name}`);

          // Normalize and save jobs
          for (const scraped of scrapedJobs) {
            // Check for duplicate
            const existing = await db.query.jobs.findFirst({
              where: and(
                eq(jobs.source, source.type as "greenhouse" | "lever" | "ashby" | "workday" | "api" | "career_page" | "manual"),
                eq(jobs.externalId, scraped.externalId || "")
              ),
            });

            if (existing) {
              totalDuplicates++;
              continue;
            }

            // Find or create company
            let companyId: string | null = null;
            const companyName = source.name.replace(/Greenhouse|Lever|Ashby|Workday|API|career.?page/gi, "").trim() || source.name;
            const existingCompany = await db.query.companies.findFirst({
              where: eq(companies.name, companyName),
            });
            if (existingCompany) {
              companyId = existingCompany.id;
            } else {
              const cid = crypto.randomUUID();
              await db.insert(companies).values({
                id: cid,
                name: companyName,
                careersUrl: source.url,
              });
              companyId = cid;
            }

            // Save job
            const jobId = crypto.randomUUID();
            await db.insert(jobs).values({
              id: jobId,
              companyId,
              title: scraped.title,
              description: scraped.description || "No description available",
              location: scraped.location,
              remoteType: scraped.location?.toLowerCase().includes("remote") ? "remote" : undefined,
              source: source.type as "greenhouse" | "lever" | "ashby" | "workday" | "api" | "career_page" | "manual",
              sourceUrl: scraped.url,
              externalId: scraped.externalId,
              postedAt: new Date(),
            });
            totalSaved++;

            // Auto-match with candidate
            if (profile) {
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
                  title: scraped.title,
                  location: scraped.location,
                  remoteType: scraped.location?.toLowerCase().includes("remote") ? "remote" : undefined,
                  requiredSkills: [],
                  preferredSkills: [],
                }
              );

              await db.insert(jobMatches).values({
                id: crypto.randomUUID(),
                candidateId,
                jobId,
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
              if (matchResult.overallScore >= 50) totalMatched++;
            }
          }

          // Update source last run
          await db.update(jobSources).set({
            lastRunAt: new Date(),
            lastRunJobCount: scrapedJobs.length,
            updatedAt: new Date(),
          }).where(eq(jobSources.id, source.id));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Source scan failed";
          await logRunEvent(runId, "error", `Failed to scan ${source.name}: ${msg}`);
        }
      }

      const result = {
        jobsFound: totalFound,
        duplicatesFiltered: totalDuplicates,
        validJobs: totalSaved,
        matchedJobs: totalMatched,
      };

      await updateRunStatus(runId, "completed", result);
      await logRunEvent(runId, "info", `Search completed: ${totalFound} found, ${totalSaved} saved, ${totalMatched} matched`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Job search failed";
      await updateRunStatus(runId, "failed", undefined, msg);
      await logRunEvent(runId, "error", `Job search failed: ${msg}`);
      throw err;
    }
  });
}