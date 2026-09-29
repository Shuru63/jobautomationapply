import { Queue } from "bullmq";
import { getRedis, isRedisAvailable } from "./redis";

function createQueue(name: string): Queue | null {
  if (!isRedisAvailable()) return null;
  try {
    const connection = getRedis();
    return new Queue(name, { connection });
  } catch {
    return null;
  }
}

export const jobSearchQueue = createQueue("job-search");
export const jobAnalysisQueue = createQueue("job-analysis");
export const resumeGenQueue = createQueue("resume-generation");
export const coverLetterQueue = createQueue("cover-letter-generation");
export const applicationQueue = createQueue("application-preparation");
export const applicationSubmitQueue = createQueue("application-submission");
export const emailMonitorQueue = createQueue("email-monitoring");
export const interviewPrepQueue = createQueue("interview-preparation");

export type JobSearchJobData = {
  candidateId: string;
  sourceId?: string;
  runId: string;
};

export type JobAnalysisJobData = {
  candidateId: string;
  jobId: string;
  runId?: string;
};

export type ResumeGenJobData = {
  candidateId: string;
  jobId: string;
  template: "master" | "job_specific" | "role_specific";
  runId?: string;
};

export type CoverLetterJobData = {
  candidateId: string;
  jobId: string;
  resumeId: string;
  runId?: string;
};

export type ApplicationJobData = {
  candidateId: string;
  applicationId: string;
  jobId: string;
  runId?: string;
};

export type ApplicationSubmitJobData = {
  candidateId: string;
  applicationId: string;
  runId?: string;
  approvedByUser: boolean;
};

export type EmailMonitorJobData = {
  candidateId: string;
  accessToken: string;
};

export type InterviewPrepJobData = {
  candidateId: string;
  interviewId: string;
  applicationId: string;
};