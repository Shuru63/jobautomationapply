import { routeAIJSON } from "./router";

export type JobAnalysisResult = {
  match: boolean;
  matchScore: number;
  rating: "excellent" | "strong" | "good" | "fair" | "weak" | "poor";
  matchedSkills: string[];
  missingSkills: string[];
  experienceMatch: boolean;
  locationMatch: boolean;
  atsKeywords: string[];
  reasoning: string;
  recommendApplication: boolean;
  strengthsAndWeaknesses: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
};

export async function analyzeJobMatch(
  candidateProfile: {
    fullName: string;
    headline?: string;
    summary?: string;
    skills: string[];
    experienceYears: number;
    experienceSummary: string;
    technologies: string[];
    targetRoles: string[];
    preferredLocations: string[];
    remotePreference?: string;
    expectedSalaryMin?: number;
    expectedSalaryMax?: number;
    educationSummary: string;
  },
  jobData: {
    title: string;
    company: string;
    description: string;
    location?: string;
    remoteType?: string;
    salaryMin?: number;
    salaryMax?: number;
    experienceMin?: number;
    experienceMax?: number;
    requiredSkills: string[];
    preferredSkills: string[];
  }
): Promise<JobAnalysisResult> {
  const systemPrompt = `You are an expert job-candidate matching agent. Analyze how well a candidate matches a job posting.

SCORING CRITERIA (total 100):
- Skills match: 35 points (matched skills / total required+preferred skills)
- Experience match: 20 points (years vs requirement, relevance)
- Role match: 15 points (job title vs target roles)
- Technology match: 15 points (specific tech stack overlap)
- Location match: 10 points (remote, location preference)
- Salary match: 5 points (range alignment)

RATING SCALE:
- excellent: 85-100
- strong: 70-84
- good: 55-69
- fair: 40-54
- weak: 25-39
- poor: 0-24

IMPORTANT RULES:
- Only count skills that genuinely appear in the candidate's profile
- Do not inflate scores
- Be honest about missing skills
- Consider equivalent technologies (e.g., React/Next.js, Django/FastAPI)
- Factor in years of experience realistically
- A match score is an internal metric, not a guarantee of suitability`;

  const userMessage = `Analyze how well this candidate matches the job posting.

CANDIDATE PROFILE:
Name: ${candidateProfile.fullName}
${candidateProfile.headline ? `Headline: ${candidateProfile.headline}` : ""}
${candidateProfile.summary ? `Summary: ${candidateProfile.summary}` : ""}
Skills: ${candidateProfile.skills.join(", ")}
Technologies: ${candidateProfile.technologies.join(", ")}
Experience: ${candidateProfile.experienceYears} years
Experience Details: ${candidateProfile.experienceSummary}
Target Roles: ${candidateProfile.targetRoles.join(", ") || "Not specified"}
Preferred Locations: ${candidateProfile.preferredLocations.join(", ") || "Not specified"}
Remote Preference: ${candidateProfile.remotePreference || "Not specified"}
${candidateProfile.expectedSalaryMin ? `Expected Salary: ${candidateProfile.expectedSalaryMin} - ${candidateProfile.expectedSalaryMax || "open"}` : ""}
Education: ${candidateProfile.educationSummary}

JOB POSTING:
Title: ${jobData.title}
Company: ${jobData.company}
${jobData.location ? `Location: ${jobData.location}` : ""}
${jobData.remoteType ? `Remote Type: ${jobData.remoteType}` : ""}
${jobData.salaryMin ? `Salary: ${jobData.salaryMin} - ${jobData.salaryMax || "not specified"}` : ""}
${jobData.experienceMin !== undefined ? `Experience Required: ${jobData.experienceMin}-${jobData.experienceMax || "+"} years` : ""}
Required Skills: ${jobData.requiredSkills.join(", ") || "Not specified"}
Preferred Skills: ${jobData.preferredSkills.join(", ") || "Not specified"}

Job Description:
${jobData.description}

Respond with this exact JSON structure:
{
  "match": boolean,
  "matchScore": number (0-100),
  "rating": "excellent" | "strong" | "good" | "fair" | "weak" | "poor",
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "experienceMatch": boolean,
  "locationMatch": boolean,
  "atsKeywords": ["keyword1", "keyword2"],
  "reasoning": "Brief explanation of the match assessment",
  "recommendApplication": boolean,
  "strengthsAndWeaknesses": {
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "recommendations": ["recommendation1", "recommendation2"]
  }
}`;

  const { data } = await routeAIJSON<JobAnalysisResult>("job_analysis", systemPrompt, userMessage, {
    maxTokens: 2048,
    temperature: 0.2,
  });

  return data;
}