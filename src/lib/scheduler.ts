import cron from "node-cron";
import { jobSearchQueue, resumeGenQueue } from "./queues";
import { db } from "@/db";
import { candidateProfiles, jobSources } from "@/db/schema";
import { eq } from "drizzle-orm";

let scheduled = false;

export function startScheduler() {
  if (scheduled) return;
  scheduled = true;

  // Job search every 6 hours
  cron.schedule("0 2,8,14,20 * * *", async () => {
    console.log("[Scheduler] Running job search...");
    if (!jobSearchQueue) return;
    try {
      const profiles = await db.query.candidateProfiles.findMany();
      const sources = await db.query.jobSources.findMany({
        where: eq(jobSources.isActive, true),
      });

      if (sources.length === 0) {
        console.log("[Scheduler] No active job sources configured");
        return;
      }

      for (const profile of profiles) {
        const runId = crypto.randomUUID();
        await jobSearchQueue.add("scheduled-search", {
          candidateId: profile.id,
          runId,
        }, {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        });
        console.log(`[Scheduler] Queued job search for candidate ${profile.id}`);
      }
    } catch (err) {
      console.error("[Scheduler] Job search error:", err);
    }
  });

  // Resume generation check every hour
  cron.schedule("0 * * * *", async () => {
    console.log("[Scheduler] Checking for resume generation jobs...");
    // This is triggered by the job matching pipeline
  });

  console.log("[Scheduler] Cron jobs registered");
}

export function stopScheduler() {
  scheduled = false;
  cron.getTasks().forEach((task) => task.stop());
}