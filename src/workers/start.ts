/**
 * Worker startup script
 * Run with: npx tsx src/workers/start.ts
 *
 * This starts all background workers for the job search automation platform.
 * In production, run this as a separate process alongside the Next.js app.
 */

import { startJobSearchWorker } from "./job-search.worker";
import { startResumeWorker } from "./resume.worker";
import { startApplicationWorker, startApplicationSubmitWorker } from "./application.worker";

console.log("🚀 Starting JobPilotAI Workers...");

const jobSearchWorker = startJobSearchWorker();
const resumeWorker = startResumeWorker();
const applicationWorker = startApplicationWorker();
const submitWorker = startApplicationSubmitWorker();

console.log("✅ Workers started:");
console.log("  - Job Search Worker");
console.log("  - Resume Generation Worker");
console.log("  - Application Preparation Worker");
console.log("  - Application Submission Worker");

// Graceful shutdown
async function shutdown() {
  console.log("\n🛑 Shutting down workers...");
  await Promise.all([
    jobSearchWorker.close(),
    resumeWorker.close(),
    applicationWorker.close(),
    submitWorker.close(),
  ]);
  console.log("✅ All workers stopped");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGUSR2", shutdown); // For nodemon