import { Worker, type Job } from "bullmq";
import { getRedis } from "@/lib/redis";
import { db } from "@/db";
import { automationRuns, automationEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

export function createWorker<T = unknown>(
  name: string,
  processor: (job: Job<T>) => Promise<void>
): Worker<T> {
  const connection = getRedis();

  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute
    },
  });

  worker.on("completed", (job) => {
    console.log(`[${name}] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${name}] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[${name}] Worker error:`, err);
  });

  return worker;
}

export async function updateRunStatus(
  runId: string,
  status: "pending" | "running" | "completed" | "failed" | "cancelled",
  result?: Record<string, unknown>,
  error?: string
) {
  const updateData: Record<string, unknown> = { status };
  if (status === "running") updateData.startedAt = new Date();
  if (status === "completed" || status === "failed") updateData.completedAt = new Date();
  if (result) updateData.result = result;
  if (error) updateData.error = error;

  await db.update(automationRuns).set(updateData).where(eq(automationRuns.id, runId));
}

export async function logRunEvent(
  runId: string,
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>
) {
  await db.insert(automationEvents).values({
    id: crypto.randomUUID(),
    runId,
    level,
    message,
    details: details || {},
  });
}