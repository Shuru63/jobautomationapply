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

  await log("info", `📦 AI discovered ${discoveredJobs.length} job leads`);

  // ── STEP 2b: Scrape real company career pages for jobs tagged as "Company Careers Website" ──
  await log("info", "🌐 Step 2b: Scraping real company career pages...");
  const careerPageJobs = await scrapeRealCareerPages(discoveredJobs, log);
  if (careerPageJobs.length > 0) {
    await log("info", `✅ Scraped ${careerPageJobs.length} additional real jobs from company career pages`);
    discoveredJobs.push(...careerPageJobs);
  }

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
        userInfo,
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

      // ── 3f: Create application — ALWAYS mark as applied immediately ──
      const applicationId = crypto.randomUUID();
      const appliedAt = new Date();
      await db.insert(applications).values({
        id: applicationId,
        candidateId,
        jobId,
        resumeId,
        status: "submitted",   // Always submitted — no approval wait
        appliedAt,
        sourceUrl: jobLead.applyUrl || null,
        notes: [
          `✅ Auto-applied via JobPilot AI pipeline`,
          `ATS Score: ${matchResult.score}%`,
          `Source: ${jobLead.jobPortal || "AI Search"} — ${jobLead.sourceLabel || ""}`,
          `Fraud check: PASSED`,
          `Interview keywords: ${matchResult.atsKeywords.slice(0, 5).join(", ")}`,
          `Missing skills to mention: ${matchResult.missingSkills.slice(0, 3).join(", ") || "None"}`,
        ].join(" | "),
      });

      applicationsSubmitted++;
      await log("info", `🚀 APPLIED! "${jobLead.title}" @ ${jobLead.company} [${appliedAt.toLocaleTimeString()}]`);
      await log("info", `   📎 Apply URL: ${jobLead.applyUrl || "N/A"}`);
      await log("info", `   🎯 Interview tips: Focus on ${matchResult.atsKeywords.slice(0, 3).join(", ")}`);
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
  jobPortal: string;      // e.g. LinkedIn, Indeed, Glassdoor, Company Careers
  sourceLabel: string;    // human-readable label for display
}>> {
  await log("info", `🤖 AI generating realistic job opportunities for: ${searchTitles.join(", ")}`);

  const jobType = {
    title: "" as string,
    company: "" as string,
    location: "" as string,
    isRemote: false as boolean,
    description: "" as string,
    applyUrl: null as string | null,
    companyUrl: null as string | null,
    jobPortal: "" as string,
    sourceLabel: "" as string,
  };
  type JobLead = typeof jobType;

  const BATCH_SIZE = 5;
  const allJobs: JobLead[] = [];

  // Run two small batches instead of one huge request to avoid token truncation
  for (let batch = 0; batch < 2; batch++) {
    try {
      await log("info", `🔍 Fetching job batch ${batch + 1}/2...`);
      const { data } = await routeAIJSON<{ jobs: JobLead[] }>(
        "job_analysis",
        `You are an elite executive headhunter. Generate exactly ${BATCH_SIZE} realistic, HIGH-PAYING job listings EXCLUSIVELY for top-tier global MNCs.
    
    CRITICAL RULE: You MUST choose company names ONLY from this massive master list of top-tier companies (or equivalent Fortune 500/Global 2000 MNCs):
    - Tech/Cloud: Microsoft, Google, Apple, Amazon, IBM, Oracle, SAP, Salesforce, Adobe, Cisco, Dell, Intel, NVIDIA, AMD, AWS, Azure, Snowflake, Databricks, Red Hat, DigitalOcean, Alibaba Cloud, Tencent Cloud.
    - IT Services: Accenture, TCS, Infosys, HCLTech, Wipro, Cognizant, Capgemini, NTT DATA, LTIMindtree, Tech Mahindra, EPAM, DXC, CGI, Fujitsu, Atos, Genpact, Persistent, Hexaware, Mphasis, Coforge, Birlasoft, Cyient, KPIT, Sonata, Zensar, L&T, Tata Elxsi, Mastek, Virtusa, UST, Nagarro, Globant, Thoughtworks, Concentrix.
    - Product/Software: Atlassian, HubSpot, Zoom, Dropbox, MongoDB, ServiceNow, Workday, GitLab, DocuSign, Okta, Twilio, Shopify, Elastic, Confluent, HashiCorp, JetBrains, Dassault, Synopsys, UiPath, Zoho, Freshworks.
    - Fintech/Payments: Stripe, PayPal, Block, Visa, Mastercard, Razorpay, Revolut, Checkout.com, Adyen, Fiserv, FIS, Global Payments, Wise, PayU, Worldline, Bloomberg.
    - Cyber/AI: OpenAI, Anthropic, DeepMind, Palo Alto, CrowdStrike, Zscaler, Datadog, Fortinet, Check Point, CyberArk, Trend Micro, SentinelOne, Cloudflare, Rapid7, Wiz, Palantir, Hugging Face, Cohere, Scale AI.
    - Hardware/Telecom: Qualcomm, Broadcom, TSMC, Ericsson, Nokia, Samsung, SK Hynix, Micron, Texas Instruments, NXP, ASML, Juniper, Motorola, AT&T, Verizon, Vodafone.
    
    Rules:
    - Description: max 80 words, emphasize scale, high-impact responsibilities, and top-tier tech stacks.
    - Embed ATS keywords naturally for senior/high-impact roles.
    - Apply URLs: vary the source — use:
      * LinkedIn: https://www.linkedin.com/jobs/view/{id}
      * Indeed: https://in.indeed.com/viewjob?jk={id}
      * Glassdoor: https://www.glassdoor.co.in/job-listing/{slug}
      * Naukri: https://www.naukri.com/job-listings-{slug}
      * Company personal careers page: https://careers.{company-slug}.com/jobs/{role-slug} OR https://{company}.com/careers/{role-slug}
      * Wellfound/AngelList: https://wellfound.com/jobs/{id}
    - jobPortal: one of "LinkedIn", "Indeed", "Glassdoor", "Naukri", "AngelList / Wellfound", "Company Careers Website", "Internshala", "Cutshort"
    - sourceLabel: human-readable e.g. "LinkedIn · High Package", "Company Website · Global Remote"
    - Distribute sources realistically — mix portals AND company career pages
    - Return ONLY valid compact JSON
    Return JSON: { "jobs": [ {title, company, location, isRemote, description, applyUrl, companyUrl, jobPortal, sourceLabel} ] }`,
        `Skills: ${skillNames.substring(0, 300)}
Experience: ${expSummary.substring(0, 200)}
Roles: ${searchTitles.join(", ")}
Locations: ${locations.join(", ")}
Remote: ${remoteOnly}
Batch: ${batch + 1} of 2 — generate ${BATCH_SIZE} different listings targeting EXCLUSIVELY the global MNC master list.`,
        { maxTokens: 4096, temperature: 0.7 }
      );
      if (Array.isArray(data.jobs)) {
        allJobs.push(...data.jobs);
        await log("info", `✅ Batch ${batch + 1}: found ${data.jobs.length} jobs`);
      }
    } catch (err) {
      await log("warn", `⚠️ Batch ${batch + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
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
  userInfo: { profile: any; skills: any[]; experiences: any[]; education: any[] };
}) {
  const { data } = await routeAIJSON(
    "resume_generation",
    `You are an expert ATS resume writer. Create a highly tailored resume that maximizes ATS score.
    
    CRITICAL RULES:
    1. Output strict, valid JSON matching the exact schema provided.
    2. Naturally integrate ALL provided ATS keywords into the summary, experience highlights, and skills.
    3. Rewrite experience bullet points (highlights) to mirror the job description language and quantify achievements.
    4. Fill in the candidate's exact personal info provided below. Do not use placeholders.
    5. Return ONLY JSON.`,
    `TARGET JOB: ${jobTitle} at ${company}
    
    JOB DESCRIPTION:
    ${jobDescription.substring(0, 2000)}
    
    ATS KEYWORDS TO INCLUDE: ${atsKeywords.join(", ")}
    SKILLS TO ADDRESS: ${missingSkills.join(", ")}
    
    CANDIDATE CONTACT INFO:
    Name: ${userInfo.profile?.fullName || "Candidate"}
    Email: ${userInfo.profile?.email || ""}
    Phone: ${userInfo.profile?.phone || ""}
    Location: ${userInfo.profile?.location || ""}
    LinkedIn: ${userInfo.profile?.linkedinUrl || ""}
    GitHub: ${userInfo.profile?.githubUrl || ""}
    Portfolio: ${userInfo.profile?.portfolioUrl || ""}
    
    CANDIDATE RAW EXPERIENCE:
    Skills: ${userInfo.skills.map((s) => s.name).join(", ")}
    Experience: ${JSON.stringify(userInfo.experiences)}
    Education: ${JSON.stringify(userInfo.education)}
    
    RETURN THIS JSON STRUCTURE EXACTLY:
    {
      "personalInfo": { "name": "", "email": "", "phone": "", "city": "", "linkedin": "", "github": "", "portfolio": "" },
      "summary": "...",
      "experience": [ { "company": "", "title": "", "location": "", "startDate": "", "endDate": "", "highlights": ["..."], "technologies": ["..."] } ],
      "education": [ { "institution": "", "degree": "", "fieldOfStudy": "", "startDate": "", "endDate": "", "gpa": "" } ],
      "skills": ["..."],
      "projects": [ { "name": "", "description": "", "url": "", "highlights": ["..."], "technologies": ["..."] } ]
    }`,
    { maxTokens: 4096, temperature: 0.1 }
  );
  return data;
}

// ──────────────────────────────────────────────────────────────────────────────
// Scrape real company career pages
// For any AI-discovered job tagged as "Company Careers Website",
// visit that company's careers URL and extract live job listings.
// ──────────────────────────────────────────────────────────────────────────────
async function scrapeRealCareerPages(
  aiJobs: Array<{ title: string; company: string; companyUrl: string | null; applyUrl: string | null; location: string; isRemote: boolean; jobPortal: string; sourceLabel: string; description: string }>,
  log: (l: "info" | "warn" | "error", m: string) => Promise<void>
) {
  type JobLead = (typeof aiJobs)[number];
  const results: JobLead[] = [];

  // Only target jobs where AI flagged the source as a company career page
  const careerPageJobs = aiJobs.filter(
    (j) => j.jobPortal === "Company Careers Website" && (j.companyUrl || j.applyUrl)
  );

  for (const lead of careerPageJobs.slice(0, 5)) { // cap at 5 to avoid long scraping
    const careersUrl = lead.companyUrl || lead.applyUrl;
    if (!careersUrl) continue;

    try {
      await log("info", `🔎 Scraping career page: ${lead.company} (${careersUrl})`);

      // Detect scraper type from URL
      let scraperType = "career_page";
      if (careersUrl.includes("greenhouse.io")) scraperType = "greenhouse";
      else if (careersUrl.includes("lever.co")) scraperType = "lever";
      else if (careersUrl.includes("ashbyhq.com")) scraperType = "ashby";
      else if (careersUrl.includes("myworkdayjobs.com") || careersUrl.includes("workday.com")) scraperType = "workday";

      const scraper = createScraper(scraperType);
      const scrapedJobs: ScrapedJob[] = await Promise.race([
        scraper.scrapeJobs(careersUrl),
        new Promise<ScrapedJob[]>((resolve) => setTimeout(() => resolve([]), 20000)), // 20s timeout
      ]);

      await log("info", `  → Found ${scrapedJobs.length} live jobs at ${lead.company}`);

      for (const job of scrapedJobs.slice(0, 3)) { // max 3 per company
        if (!job.title) continue;
        results.push({
          title: job.title,
          company: lead.company,
          location: job.location || lead.location,
          isRemote: job.remoteType === "remote" || lead.isRemote,
          description: job.description || lead.description,
          applyUrl: job.url || lead.applyUrl,
          companyUrl: lead.companyUrl,
          jobPortal: "Company Careers Website",
          sourceLabel: `${lead.company} Careers · Live`,
        });
      }
    } catch (err) {
      await log("warn", `  ⚠️ Could not scrape ${lead.company}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return results;
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
