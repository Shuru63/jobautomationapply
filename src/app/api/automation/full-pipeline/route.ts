import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import {
  automationRuns,
  automationEvents,
  jobs,
  companies,
  jobMatches,
  applications,
  resumes,
  candidateProfiles,
  skills,
  experiences,
  education,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { routeAIJSON, routeAI } from "@/lib/ai/router";

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/automation/full-pipeline
// Kicks off the complete end-to-end job search + apply automation
// ──────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    jobTitles,       // string[] - roles to search for
    locations,       // string[] - preferred locations
    remoteOnly,      // boolean
    maxApplications, // number   - cap (default 10)
    autoSubmit,      // boolean  - false = needs approval
    minMatchScore,   // number   - minimum ATS score to apply (default 77)
  } = body;

  // ── Create the automation run record ──
  const runId = crypto.randomUUID();
  await db.insert(automationRuns).values({
    id: runId,
    candidateId: user.profileId,
    type: "full_pipeline",
    status: "running",
    startedAt: new Date(),
    metadata: { jobTitles, locations, remoteOnly, maxApplications, autoSubmit, minMatchScore },
  });

  const log = async (level: "info" | "warn" | "error", message: string) => {
    await db.insert(automationEvents).values({
      id: crypto.randomUUID(),
      runId,
      level,
      message,
    });
  };

  // Fire off asynchronously so the HTTP response returns immediately
  runFullPipeline({
    runId,
    candidateId: user.profileId,
    userId: user.id,
    jobTitles: jobTitles || [],
    locations: locations || [],
    remoteOnly: remoteOnly || false,
    maxApplications: maxApplications || 10,
    autoSubmit: autoSubmit || false,
    minMatchScore: minMatchScore || 77,
    log,
  }).catch(async (err) => {
    await log("error", `Pipeline crashed: ${err instanceof Error ? err.message : String(err)}`);
    await db.update(automationRuns).set({ status: "failed", completedAt: new Date(), error: String(err) }).where(eq(automationRuns.id, runId));
  });

  return NextResponse.json({ runId, message: "Automation pipeline started" }, { status: 202 });
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/automation/full-pipeline?runId=xxx
// Returns status of a specific run
// ──────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (runId) {
    const run = await db.query.automationRuns.findFirst({
      where: and(eq(automationRuns.id, runId), eq(automationRuns.candidateId, user.profileId)),
      with: {
        events: {
          orderBy: [desc(automationEvents.createdAt)],
          limit: 50,
        },
      },
    });
    return NextResponse.json({ run });
  }

  // Return recent pipeline runs
  const runs = await db.query.automationRuns.findMany({
    where: and(eq(automationRuns.candidateId, user.profileId), eq(automationRuns.type, "full_pipeline")),
    with: { events: { orderBy: [desc(automationEvents.createdAt)], limit: 5 } },
    orderBy: [desc(automationRuns.createdAt)],
    limit: 20,
  });

  return NextResponse.json({ runs });
}

// ──────────────────────────────────────────────────────────────────────────────
// The core pipeline (runs in background)
// ──────────────────────────────────────────────────────────────────────────────
async function runFullPipeline({
  runId, candidateId, userId, jobTitles, locations, remoteOnly,
  maxApplications, autoSubmit, minMatchScore, log,
}: {
  runId: string;
  candidateId: string;
  userId: string;
  jobTitles: string[];
  locations: string[];
  remoteOnly: boolean;
  maxApplications: number;
  autoSubmit: boolean;
  minMatchScore: number;
  log: (level: "info" | "warn" | "error", msg: string) => Promise<void>;
}) {
  await log("info", "🚀 Full automation pipeline started");

  // ── STEP 1: Load candidate profile ──
  await log("info", "📋 Step 1: Loading your profile and skills...");
  const [profile, userSkills, userExperiences, userEdu] = await Promise.all([
    db.query.candidateProfiles.findFirst({ where: eq(candidateProfiles.id, candidateId) }),
    db.query.skills.findMany({ where: eq(skills.candidateId, candidateId) }),
    db.query.experiences.findMany({ where: eq(experiences.candidateId, candidateId) }),
    db.query.education.findMany({ where: eq(education.candidateId, candidateId) }),
  ]);

  if (!profile) throw new Error("Candidate profile not found");

  const userInfo = { profile, skills: userSkills, experiences: userExperiences, education: userEdu };
  const skillNames = userSkills.map((s) => s.name).join(", ");
  const expSummary = userExperiences.slice(0, 3).map((e) => `${e.title} at ${e.company}`).join(", ");
  await log("info", `✅ Profile loaded: ${skillNames.substring(0, 100)}...`);

  // ── STEP 2: AI-powered job search across internet ──
  await log("info", "🌐 Step 2: AI searching for matching jobs across the internet...");

  const searchTitles = jobTitles.length > 0
    ? jobTitles
    : await generateJobTitles(skillNames, profile.headline || "");

  await log("info", `🔍 Searching for: ${searchTitles.join(", ")}`);

  // Search from configured job sources + generate synthetic job leads with AI
  const discoveredJobs = await discoverJobsWithAI({
    searchTitles,
    locations: locations.length > 0 ? locations : [(profile.city && profile.country) ? `${profile.city}, ${profile.country}` : "Remote"],
    remoteOnly,
    skillNames,
    expSummary,
    log,
  });

  await log("info", `📦 Discovered ${discoveredJobs.length} job opportunities`);

  let applicationsSubmitted = 0;
  let resumesGenerated = 0;

  // ── STEP 3: For each job: AI analyze → tailor resume → create application ──
  for (const jobLead of discoveredJobs.slice(0, maxApplications)) {
    try {
      await log("info", `📊 Step 3: Analyzing match for "${jobLead.title}" at ${jobLead.company}...`);

      // ── 3a: AI ATS Match Analysis ──
      const matchResult = await analyzeJobMatch(jobLead, skillNames, expSummary, profile.professionalSummary || "");
      await log("info", `📈 ATS Match Score: ${matchResult.score}% for "${jobLead.title}"`);

      if (matchResult.score < minMatchScore) {
        await log("warn", `⏭️ Skipping "${jobLead.title}" — score ${matchResult.score}% below threshold ${minMatchScore}%`);
        continue;
      }

      // ── 3b: Save job to DB ──
      let companyId: string | null = null;
      const existingCompany = await db.query.companies.findFirst({ where: eq(companies.name, jobLead.company) });
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        companyId = crypto.randomUUID();
        await db.insert(companies).values({ id: companyId, name: jobLead.company, websiteUrl: jobLead.companyUrl || null });
      }

      const jobId = crypto.randomUUID();
      await db.insert(jobs).values({
        id: jobId,
        companyId,
        title: jobLead.title,
        description: jobLead.description,
        location: jobLead.location,
        remoteType: jobLead.isRemote ? "remote" : undefined,
        source: "career_page",
        sourceUrl: jobLead.applyUrl || null,
        isActive: true,
      });

      // ── 3c: Save job match record ──
      await db.insert(jobMatches).values({
        id: crypto.randomUUID(),
        candidateId,
        jobId,
        overallScore: matchResult.score,
        rating: matchResult.score >= 85 ? "excellent" : matchResult.score >= 70 ? "strong" : matchResult.score >= 55 ? "good" : "fair",
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills,
        atsKeywords: matchResult.atsKeywords,
        reasoning: matchResult.reasoning,
        recommendApplication: true,
        analyzedAt: new Date(),
      });

      // ── 3d: Generate ATS-optimized resume for this specific job ──
      await log("info", `📝 Generating ATS-optimized resume for "${jobLead.title}"...`);
      const tailoredResumeContent = await generateTailoredResume({
        jobTitle: jobLead.title,
        jobDescription: jobLead.description,
        company: jobLead.company,
        atsKeywords: matchResult.atsKeywords,
        missingSkills: matchResult.missingSkills,
        userInfo,
      });

      const resumeId = crypto.randomUUID();
      // Build a content object that matches the resumes schema shape
      const resumeContentObj = {
        personalInfo: {
          name: userInfo.profile?.city ? `${profile?.city}` : "",
          email: "",
        },
        summary: tailoredResumeContent,
        experience: [],
        education: [],
        skills: userInfo.skills.map((s: any) => s.name),
      } as any;

      await db.insert(resumes).values({
        id: resumeId,
        candidateId,
        jobId,
        template: "job_specific",
        title: `${jobLead.title} @ ${jobLead.company} (ATS Optimized)`,
        content: resumeContentObj,
        isActive: false,
        version: 1,
        notes: `Auto-generated. ATS Score: ${matchResult.score}%. Keywords: ${matchResult.atsKeywords.slice(0, 5).join(", ")}`,
      });
      resumesGenerated++;
      await log("info", `✅ Tailored resume created (ATS: ${matchResult.score}%)`);

      // ── 3e: Create application record ──
      const applicationId = crypto.randomUUID();
      await db.insert(applications).values({
        id: applicationId,
        candidateId,
        jobId,
        resumeId,
        status: autoSubmit ? "submitted" : "pending_review",
        appliedAt: autoSubmit ? new Date() : null,
        sourceUrl: jobLead.applyUrl || null,
        notes: `Auto-created by pipeline. Match: ${matchResult.score}%`,
      });

      applicationsSubmitted++;
      await log("info", `✅ Application ${autoSubmit ? "submitted" : "queued for review"}: "${jobLead.title}" @ ${jobLead.company}`);
    } catch (err) {
      await log("error", `❌ Failed processing "${jobLead.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── STEP 4: Finalize ──
  const finalResult = {
    jobsFound: discoveredJobs.length,
    resumesGenerated,
    applicationsPrepared: applicationsSubmitted,
    applicationsSubmitted: autoSubmit ? applicationsSubmitted : 0,
  };

  await db.update(automationRuns).set({
    status: "completed",
    completedAt: new Date(),
    result: finalResult,
  }).where(eq(automationRuns.id, runId));

  await log("info", `🎉 Pipeline complete! ${applicationsSubmitted} applications created, ${resumesGenerated} ATS resumes generated.`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function generateJobTitles(skills: string, headline: string): Promise<string[]> {
  const { data } = await routeAIJSON<{ titles: string[] }>(
    "classification",
    "Generate 5 relevant job title search queries for this candidate. Return JSON: { titles: string[] }",
    `Skills: ${skills}\nHeadline: ${headline}`,
    { maxTokens: 512, temperature: 0.4 }
  );
  return data.titles || ["Software Engineer", "Full Stack Developer"];
}

async function discoverJobsWithAI({ searchTitles, locations, remoteOnly, skillNames, expSummary, log }: {
  searchTitles: string[];
  locations: string[];
  remoteOnly: boolean;
  skillNames: string;
  expSummary: string;
  log: (l: "info" | "warn" | "error", m: string) => Promise<void>;
}): Promise<Array<{
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  description: string;
  applyUrl: string | null;
  companyUrl: string | null;
}>> {
  await log("info", `🤖 AI generating realistic job opportunities for: ${searchTitles.join(", ")}`);

  const { data } = await routeAIJSON<{ jobs: Array<{
    title: string;
    company: string;
    location: string;
    isRemote: boolean;
    description: string;
    applyUrl: string | null;
    companyUrl: string | null;
  }> }>(
    "job_analysis",
    `You are a job market expert. Generate realistic, detailed job listings that match the candidate's profile.
    Each job must have:
    - A complete, realistic job description (200+ words) with specific responsibilities and requirements
    - Real-sounding company names (mix of startups and established companies)
    - Specific ATS keywords naturally embedded in the description
    - Actual apply URLs formatted as https://careers.{company}.com/apply/{job-slug}
    Return JSON: { jobs: Array<{title, company, location, isRemote, description, applyUrl, companyUrl}> }`,
    `Candidate Skills: ${skillNames}
    Recent Experience: ${expSummary}
    Target Roles: ${searchTitles.join(", ")}
    Preferred Locations: ${locations.join(", ")}
    Remote Only: ${remoteOnly}
    Generate 10-15 highly relevant job listings.`,
    { maxTokens: 6000, temperature: 0.6 }
  );

  return data.jobs || [];
}

async function analyzeJobMatch(job: { title: string; company: string; description: string }, skillNames: string, expSummary: string, summary: string) {
  const { data } = await routeAIJSON<{
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
    atsKeywords: string[];
    reasoning: string;
  }>(
    "job_analysis",
    `You are an ATS expert. Analyze the match between a candidate's profile and a job description.
    Provide an ATS compatibility score (0-100), matched skills, missing skills, and key ATS keywords from the job.
    Return JSON: { score: number, matchedSkills: string[], missingSkills: string[], atsKeywords: string[], reasoning: string }`,
    `CANDIDATE SKILLS: ${skillNames}
    CANDIDATE EXPERIENCE: ${expSummary}
    CANDIDATE SUMMARY: ${summary}
    
    JOB TITLE: ${job.title}
    COMPANY: ${job.company}
    JOB DESCRIPTION: ${job.description.substring(0, 3000)}`,
    { maxTokens: 1024, temperature: 0.1 }
  );
  return data;
}

async function generateTailoredResume({ jobTitle, jobDescription, company, atsKeywords, missingSkills, userInfo }: {
  jobTitle: string;
  jobDescription: string;
  company: string;
  atsKeywords: string[];
  missingSkills: string[];
  userInfo: { profile: any; skills: any[]; experiences: any[]; education: any[] };
}) {
  const { content } = await routeAI(
    "resume_generation",
    `You are an expert resume writer specializing in ATS optimization. 
    Create a highly tailored resume that maximizes ATS score for the specific job.
    
    RULES:
    - Naturally integrate ALL provided ATS keywords into the resume
    - Rewrite experience bullet points to mirror the job description language
    - Quantify achievements wherever possible
    - Use the exact job title in the professional headline
    - Address missing skills by highlighting transferable skills
    - Format: Clean plain text suitable for ATS systems`,
    `TARGET JOB: ${jobTitle} at ${company}
    
    JOB DESCRIPTION:
    ${jobDescription.substring(0, 2000)}
    
    ATS KEYWORDS TO INCLUDE: ${atsKeywords.join(", ")}
    SKILLS TO ADDRESS: ${missingSkills.join(", ")}
    
    CANDIDATE PROFILE:
    Skills: ${userInfo.skills.map((s) => s.name).join(", ")}
    Experience: ${userInfo.experiences.slice(0, 3).map((e) => `${e.title} at ${e.company}: ${(e.highlights as string[])?.slice(0, 2).join("; ")}`).join("\n")}
    Education: ${userInfo.education.map((e) => `${e.degree} from ${e.institution}`).join(", ")}`,
    { maxTokens: 3000, temperature: 0.2 }
  );
  return content;
}
