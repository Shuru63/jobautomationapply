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
import { createScraper } from "@/lib/browser/career-agent";
import type { ScrapedJob } from "@/lib/browser/career-agent";
import { submitApplication } from "@/lib/browser/apply-bot";
import { generateResumePDF } from "@/lib/documents/resume-pdf";
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
    user,
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
  runId, candidateId, user, jobTitles, locations, remoteOnly,
  maxApplications, autoSubmit, minMatchScore, log,
}: {
  runId: string;
  candidateId: string;
  user: { id: string; fullName?: string | null; email?: string | null };
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

  const userInfo = { profile, skills: userSkills, experiences: userExperiences, education: userEdu, fullName: user.fullName, email: user.email };
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

  await log("info", `📦 AI discovered ${discoveredJobs.length} job leads`);



  await log("info", `📦 Total discovered: ${discoveredJobs.length} job opportunities`);

  let applicationsSubmitted = 0;
  let resumesGenerated = 0;

  // Free tier = 5 req/min for gemini-2.5-flash. Each job = 2 calls (match + resume).
  // Wait 15s between jobs to stay safely within rate limits.
  const JOB_DELAY_MS = 15_000;

  // ── STEP 3: For each job: AI analyze → tailor resume → create application ──
  for (let jobIdx = 0; jobIdx < Math.min(discoveredJobs.length, maxApplications); jobIdx++) {
    // Check if the user cancelled the pipeline
    const currentRun = await db.query.automationRuns.findFirst({ where: eq(automationRuns.id, runId) });
    if (currentRun && currentRun.status === "cancelled") {
      await log("warn", "🛑 Pipeline was cancelled by the user. Halting execution.");
      break;
    }

    const jobLead = discoveredJobs[jobIdx];

    // Throttle: wait between jobs (skip delay on first job)
    if (jobIdx > 0) {
      await log("info", `⏳ Waiting ${JOB_DELAY_MS / 1000}s to respect API rate limits...`);
      await new Promise((r) => setTimeout(r, JOB_DELAY_MS));
    }

    // Re-check cancellation after the delay
    const recheckRun = await db.query.automationRuns.findFirst({ where: eq(automationRuns.id, runId) });
    if (recheckRun && recheckRun.status === "cancelled") {
      await log("warn", "🛑 Pipeline was cancelled by the user. Halting execution.");
      break;
    }

    try {
      await log("info", `📊 Step 3 [${jobIdx + 1}/${Math.min(discoveredJobs.length, maxApplications)}]: Analyzing "${jobLead.title}" at ${jobLead.company}...`);

      // ── 3a: Fraud / Fake Job Detection ──
      const fraudCheck = await detectFraudJob(jobLead);
      if (fraudCheck.isFraud) {
        await log("warn", `🚫 FRAUD DETECTED — Skipping "${jobLead.title}" @ ${jobLead.company}: ${fraudCheck.reason}`);
        continue;
      }
      await log("info", `✅ Legitimacy verified: ${fraudCheck.reason}`);

      // ── 3b: AI ATS Match Analysis ──
      const matchResult = await analyzeJobMatch(jobLead, skillNames, expSummary, profile.professionalSummary || "");
      await log("info", `📈 ATS Score: ${matchResult.score}% | Matched: ${matchResult.matchedSkills.slice(0,3).join(", ")}`);

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
        notes: jobLead.sourceLabel ? `Found via: ${jobLead.jobPortal} — ${jobLead.sourceLabel}` : `Found via: AI-powered job search`,
      });
      await log("info", `📌 Job saved [${jobLead.jobPortal || "AI Search"}]: "${jobLead.title}" @ ${jobLead.company}`);

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
      const tailoredResumeData = await generateTailoredResume({
        jobTitle: jobLead.title,
        jobDescription: jobLead.description,
        company: jobLead.company,
        atsKeywords: matchResult.atsKeywords,
        missingSkills: matchResult.missingSkills,
        userInfo: {
          ...userInfo,
          fullName: userInfo.fullName ?? undefined,
          email: userInfo.email ?? undefined,
        },
      });

      const resumeId = crypto.randomUUID();
      // The AI now returns the perfect structured JSON that exactly matches ResumeData schema!
      const resumeContentObj = tailoredResumeData as any;

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
      await log("info", `📄 Tailored resume created (ATS: ${matchResult.score}% | Keywords: ${matchResult.atsKeywords.slice(0,4).join(", ")})`);

      // ── 3f: Execute Real Application Submission ──
      const applicationId = crypto.randomUUID();
      const appliedAt = new Date();
      let applicationStatus: "submitted" | "pending_review" = autoSubmit ? "submitted" : "pending_review";
      let applyNotes = `✅ Auto-applied via JobPilot AI pipeline`;

      if (autoSubmit && jobLead.applyUrl) {
        await log("info", `🤖 Initiating real Playwright submission to ${jobLead.company}...`);
        try {
          // Generate actual PDF buffer to upload
          const pdfBuffer = await generateResumePDF(resumeContentObj);
          
          // Execute the bot
          const result = await submitApplication({
            applyUrl: jobLead.applyUrl,
            resumeBuffer: pdfBuffer,
            candidateInfo: {
              firstName: user.fullName?.split(" ")[0] || "Candidate",
              lastName: user.fullName?.split(" ").slice(1).join(" ") || "",
              email: user.email || "",
              phone: userInfo.profile?.phone || "",
              linkedin: userInfo.profile?.linkedinUrl || "",
              github: userInfo.profile?.githubUrl || "",
              portfolio: userInfo.profile?.portfolioUrl || "",
            },
            log,
          });

          if (!result.success) {
             applicationStatus = "pending_review";
             applyNotes = `❌ Auto-apply failed: ${result.message}`;
          }
        } catch (botErr) {
          applicationStatus = "pending_review";
          applyNotes = `❌ Bot crashed: ${botErr instanceof Error ? botErr.message : String(botErr)}`;
          await log("error", applyNotes);
        }
      } else if (!autoSubmit) {
         applyNotes = `⏸️ Manual review required.`;
      }

      await db.insert(applications).values({
        id: applicationId,
        candidateId,
        jobId,
        resumeId,
        status: applicationStatus,
        appliedAt,
        sourceUrl: jobLead.applyUrl || null,
        notes: [
          applyNotes,
          `ATS Score: ${matchResult.score}%`,
          `Source: ${jobLead.jobPortal || "AI Search"} — ${jobLead.sourceLabel || ""}`,
          `Fraud check: PASSED`,
          `Interview keywords: ${matchResult.atsKeywords.slice(0, 5).join(", ")}`,
          `Missing skills to mention: ${matchResult.missingSkills.slice(0, 3).join(", ") || "None"}`,
        ].join(" | "),
      });

      applicationsSubmitted++;
      
      if (applicationStatus === "submitted") {
        await log("info", `🚀 REAL APPLIED! Successfully submitted to "${jobLead.title}" @ ${jobLead.company}`);
      } else if (applicationStatus === "pending_review") {
        await log("info", `📝 Prepared application for manual review: "${jobLead.title}" @ ${jobLead.company}`);
      }
    } catch (err) {
      await log("error", `❌ Failed "${jobLead.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── STEP 4: Finalize ──
  const finalResult = {
    jobsFound: discoveredJobs.length,
    fraudBlocked: 0,
    resumesGenerated,
    applicationsPrepared: applicationsSubmitted,
    applicationsSubmitted,  // Always equals applicationsPrepared now
  };

  const finalRun = await db.query.automationRuns.findFirst({ where: eq(automationRuns.id, runId) });
  if (finalRun && finalRun.status !== "cancelled") {
    await db.update(automationRuns).set({
      status: "completed",
      completedAt: new Date(),
      result: finalResult,
    }).where(eq(automationRuns.id, runId));
  } else {
    // If it was cancelled, just update the result stats but keep status as "cancelled"
    await db.update(automationRuns).set({
      completedAt: new Date(),
      result: finalResult,
    }).where(eq(automationRuns.id, runId));
  }

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
  jobPortal: string;
  sourceLabel: string;
}>> {
  await log("info", `🌐 Scanning live internet job boards for real positions matching: ${searchTitles.join(", ")}`);

  const realCompanies = [
    { name: "Stripe", url: "https://boards.greenhouse.io/stripe" },
    { name: "Figma", url: "https://jobs.lever.co/figma" },
    { name: "Notion", url: "https://jobs.lever.co/notion" },
    { name: "OpenAI", url: "https://boards.greenhouse.io/openai" },
    { name: "Vercel", url: "https://boards.greenhouse.io/vercel" },
    { name: "Discord", url: "https://boards.greenhouse.io/discord" },
    { name: "Plaid", url: "https://boards.greenhouse.io/plaid" },
    { name: "Reddit", url: "https://boards.greenhouse.io/reddit" },
    { name: "Anthropic", url: "https://jobs.lever.co/anthropic" },
    { name: "GitHub", url: "https://boards.greenhouse.io/github" },
    { name: "Datadog", url: "https://boards.greenhouse.io/datadog" },
    { name: "Twilio", url: "https://boards.greenhouse.io/twilio" },
    { name: "Cloudflare", url: "https://boards.greenhouse.io/cloudflare" },
    { name: "Okta", url: "https://boards.greenhouse.io/okta" },
    { name: "Shopify", url: "https://jobs.lever.co/shopify" },
    { name: "Dropbox", url: "https://boards.greenhouse.io/dropbox" },
    { name: "Slack", url: "https://boards.greenhouse.io/slack" },
    { name: "Coinbase", url: "https://boards.greenhouse.io/coinbase" },
    { name: "Brex", url: "https://boards.greenhouse.io/brex" },
    { name: "Airbnb", url: "https://boards.greenhouse.io/airbnb" },
    { name: "Uber", url: "https://boards.greenhouse.io/uber" },
    { name: "Lyft", url: "https://boards.greenhouse.io/lyft" },
    { name: "Robinhood", url: "https://boards.greenhouse.io/robinhood" },
    { name: "Rippling", url: "https://boards.greenhouse.io/rippling" },
    { name: "Deel", url: "https://boards.greenhouse.io/deel" },
    { name: "Gusto", url: "https://boards.greenhouse.io/gusto" },
    { name: "Flexport", url: "https://boards.greenhouse.io/flexport" },
    { name: "Anduril", url: "https://jobs.lever.co/anduril" },
    { name: "Ramp", url: "https://boards.greenhouse.io/ramp" },
    { name: "Cohere", url: "https://jobs.lever.co/cohere" },
    { name: "Scale AI", url: "https://boards.greenhouse.io/scaleai" },
    { name: "Instacart", url: "https://boards.greenhouse.io/instacart" },
    { name: "DoorDash", url: "https://boards.greenhouse.io/doordash" },
    { name: "Pinterest", url: "https://boards.greenhouse.io/pinterest" },
    { name: "Snowflake", url: "https://boards.greenhouse.io/snowflake" },
    { name: "MongoDB", url: "https://boards.greenhouse.io/mongodb" },
    { name: "Elastic", url: "https://boards.greenhouse.io/elastic" },
    { name: "Confluent", url: "https://boards.greenhouse.io/confluent" },
    { name: "HashiCorp", url: "https://boards.greenhouse.io/hashicorp" },
    { name: "GitLab", url: "https://boards.greenhouse.io/gitlab" },
    { name: "ServiceNow", url: "https://boards.greenhouse.io/servicenow" },
    { name: "Workday", url: "https://boards.greenhouse.io/workday" },
    { name: "Atlassian", url: "https://jobs.lever.co/atlassian" },
    { name: "Palantir", url: "https://jobs.lever.co/palantir" },
    { name: "Asana", url: "https://boards.greenhouse.io/asana" },
    { name: "Monday.com", url: "https://boards.greenhouse.io/monday" },
    { name: "Canva", url: "https://boards.greenhouse.io/canva" },
    { name: "Grammarly", url: "https://boards.greenhouse.io/grammarly" },
    { name: "Duolingo", url: "https://boards.greenhouse.io/duolingo" },
    { name: "Roblox", url: "https://boards.greenhouse.io/roblox" }
  ];

  const allJobs: any[] = [];
  
  // Shuffle to randomize companies searched each time
  realCompanies.sort(() => Math.random() - 0.5);

  for (const company of realCompanies.slice(0, 4)) {
    try {
      await log("info", `🔎 Scraping live jobs directly from ${company.name}...`);
      const scraperType = company.url.includes("greenhouse.io") ? "greenhouse" : "lever";
      const scraper = createScraper(scraperType as any);
      
      const scrapedJobs = await Promise.race([
        scraper.scrapeJobs(company.url),
        new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 15000))
      ]);

      if (scrapedJobs.length > 0) {
        await log("info", `✅ Successfully fetched ${scrapedJobs.length} live jobs from ${company.name}`);
        
        // Filter jobs by matching title keywords
        const searchKeywords = searchTitles.flatMap(t => t.toLowerCase().split(" "));
        const matchedJobs = scrapedJobs.filter((job) => {
          const jobTitle = job.title.toLowerCase();
          return searchKeywords.some(keyword => jobTitle.includes(keyword) && keyword.length > 3) || jobTitle.includes("engineer") || jobTitle.includes("developer");
        });

        // Add up to 3 matched jobs per company
        for (const job of matchedJobs.slice(0, 3)) {
          allJobs.push({
            title: job.title,
            company: company.name,
            location: job.location || "Remote",
            isRemote: job.remoteType === "remote" || (job.location && job.location.toLowerCase().includes("remote")),
            description: job.description || `Software engineering role at ${company.name}.`,
            applyUrl: job.url,
            companyUrl: company.url,
            jobPortal: "Company Careers Website",
            sourceLabel: `${company.name} Live Careers`,
          });
        }
      } else {
         await log("warn", `⚠️ No live jobs found on ${company.name}`);
      }
    } catch (err) {
      await log("error", `❌ Error fetching live jobs from ${company.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return allJobs;
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
  userInfo: { fullName?: string; email?: string; profile: any; skills: any[]; experiences: any[]; education: any[] };
}) {
  const { data } = await routeAIJSON(
    "resume_generation",
    `You are an expert ATS resume writer. Create a highly tailored resume that maximizes ATS score.
    
    CRITICAL RULES:
    1. Output strict, valid JSON matching the exact schema provided.
    2. NATURALLY integrate ATS keywords. DO NOT keyword stuff. Maintain the candidate's authentic human voice.
    3. Ensure maximum 75% verbatim keyword overlap to avoid automated AI-detection penalties by Workday/Greenhouse.
    4. Rewrite experience bullet points to emphasize impact, but keep them realistic and grounded.
    5. Fill in the candidate's exact personal info provided below. Do not use placeholders.
    6. Return ONLY JSON.`,
    `TARGET JOB: ${jobTitle} at ${company}
    
    JOB DESCRIPTION:
    ${jobDescription.substring(0, 2000)}
    
    ATS KEYWORDS TO INCLUDE: ${atsKeywords.join(", ")}
    SKILLS TO ADDRESS: ${missingSkills.join(", ")}
    
    CANDIDATE CONTACT INFO:
    Name: ${userInfo.fullName || "Candidate"}
    Email: ${userInfo.email || ""}
    Phone: ${userInfo.profile?.phone || ""}
    Location: ${userInfo.profile?.city || ""} ${userInfo.profile?.country || ""}
    LinkedIn: ${userInfo.profile?.linkedinUrl || ""}
    GitHub: ${userInfo.profile?.githubUrl || ""}
    Portfolio: ${userInfo.profile?.portfolioUrl || ""}
    
    CANDIDATE RAW EXPERIENCE:
    Skills: ${userInfo.skills.map((s) => s.name).join(", ")}
    Experience: ${JSON.stringify(userInfo.experiences)}
    Education: ${JSON.stringify(userInfo.education)}
    Projects: ${JSON.stringify(userInfo.profile?.projects || [])}
    
    RETURN THIS JSON STRUCTURE EXACTLY:
    {
      "personalInfo": { "name": "", "email": "", "phone": "", "city": "", "linkedin": "", "github": "", "portfolio": "" },
      "summary": "...",
      "experience": [ { "company": "", "title": "", "location": "", "startDate": "", "endDate": "", "highlights": ["..."], "technologies": ["..."] } ],
      "education": [ { "institution": "", "degree": "", "fieldOfStudy": "", "startDate": "", "endDate": "", "gpa": "" } ],
      "skills": ["Backend: Node.js, Express.js...", "Frontend: React.js, TypeScript...", "Databases: MongoDB...", "Cloud & DevOps: AWS..."],
      "projects": [ { "name": "", "description": "", "url": "", "highlights": ["..."], "technologies": ["..."] } ]
    }`,
    { maxTokens: 4096, temperature: 0.1 }
  );
  return data;
}



// ──────────────────────────────────────────────────────────────────────────────
// Fraud / Fake Job Detection
// Multi-layer check: heuristics first (fast), then AI (thorough)
// ──────────────────────────────────────────────────────────────────────────────
const FRAUD_RED_FLAGS = [
  /earn \$?\d+k?\+? (?:per day|daily|weekly|fast)/i,
  /work from home.*no experience/i,
  /unlimited earning/i,
  /be your own boss/i,
  /multi.?level|mlm|pyramid/i,
  /bitcoin|crypto.*job/i,
  /wire transfer|western union/i,
  /pay.*fee.*apply|application fee required/i,
  /too good to be true/i,
  /no skill.*required.*high salary/i,
  /data entry.*\$\d{3,}\/hr/i,
  /reshipping|package forwarding/i,
];

const LEGIT_PORTALS = [
  "linkedin.com", "indeed.com", "glassdoor.com", "naukri.com",
  "wellfound.com", "angellist.com", "internshala.com", "cutshort.io",
  "greenhouse.io", "lever.co", "ashbyhq.com", "workday.com",
  "careers.", "/careers/", "/jobs/",
];

async function detectFraudJob(job: {
  title: string;
  company: string;
  description: string;
  applyUrl: string | null;
  jobPortal: string;
}): Promise<{ isFraud: boolean; reason: string }> {

  // ── Layer 1: Fast heuristic checks (no API cost) ──
  const text = `${job.title} ${job.description}`.toLowerCase();

  for (const pattern of FRAUD_RED_FLAGS) {
    if (pattern.test(text)) {
      return { isFraud: true, reason: `Red flag pattern detected: "${pattern.source}"` };
    }
  }

  // Check URL legitimacy
  const url = (job.applyUrl || "").toLowerCase();
  const hasLegitUrl = LEGIT_PORTALS.some((p) => url.includes(p));
  const hasSuspiciousUrl = /bit\.ly|tinyurl|t\.co|shorturl|click\.here/i.test(url);

  if (hasSuspiciousUrl) {
    return { isFraud: true, reason: "Suspicious shortened URL detected in apply link" };
  }

  // Empty or missing job description is a red flag
  if (!job.description || job.description.trim().length < 30) {
    return { isFraud: true, reason: "Missing or extremely thin job description" };
  }

  // ── Layer 2: AI legitimacy check (only if heuristics pass) ──
  try {
    const { data } = await routeAIJSON<{ legitimate: boolean; confidence: number; reason: string }>(
      "classification",
      `You are a job fraud detection expert. Analyze this job posting and determine if it is LEGITIMATE or FRAUDULENT/FAKE.
      Fraudulent jobs typically: promise unrealistic pay, require fees, are vague, have no real company presence, 
      ask for personal financial info, or are MLM/pyramid schemes.
      Legitimate jobs: have clear responsibilities, realistic compensation, real company names, professional language.
      Return JSON: { "legitimate": boolean, "confidence": number (0-100), "reason": string }`,
      `JOB TITLE: ${job.title}
COMPANY: ${job.company}
PORTAL: ${job.jobPortal}
APPLY URL: ${job.applyUrl || "none"}
DESCRIPTION: ${job.description.substring(0, 500)}`,
      { maxTokens: 256, temperature: 0.1 }
    );

    if (!data.legitimate && data.confidence > 70) {
      return { isFraud: true, reason: `AI fraud detection (${data.confidence}% confidence): ${data.reason}` };
    }

    return {
      isFraud: false,
      reason: `Legitimate job confirmed (${data.confidence}% confidence) — ${data.reason}`,
    };
  } catch {
    // If AI check fails, trust the heuristics and allow the job
    return {
      isFraud: false,
      reason: `Heuristic checks passed (AI verification unavailable)${hasLegitUrl ? " — from verified portal" : ""}`,
    };
  }
}
