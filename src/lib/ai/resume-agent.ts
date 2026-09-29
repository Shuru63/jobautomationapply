import { routeAIJSON } from "./router";

export type ResumeContent = {
  personalInfo: {
    name: string;
    email: string;
    phone?: string;
    city?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary: string;
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    highlights: string[];
    technologies?: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
  }>;
  skills: string[];
  projects?: Array<{
    name: string;
    description?: string;
    url?: string;
    technologies?: string[];
    highlights?: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
  languages?: Array<{
    name: string;
    level?: string;
  }>;
};

export async function generateResumeContent(
  candidateData: {
    fullName: string;
    email: string;
    phone?: string;
    city?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    summary?: string;
    experiences: Array<{
      company: string;
      title: string;
      location?: string;
      startDate: string;
      endDate?: string;
      isCurrent: boolean;
      highlights: string[];
      technologies: string[];
    }>;
    education: Array<{
      institution: string;
      degree: string;
      fieldOfStudy?: string;
      startDate?: string;
      endDate?: string;
      gpa?: string;
    }>;
    skills: Array<{
      name: string;
      category?: string;
      proficiencyLevel?: number;
    }>;
    projects: Array<{
      name: string;
      description?: string;
      url?: string;
      technologies: string[];
      highlights: string[];
    }>;
    certifications: Array<{
      name: string;
      issuer?: string;
      date?: string;
    }>;
    languages: Array<{
      name: string;
      level?: string;
    }>;
  },
  jobTarget?: {
    title: string;
    company: string;
    description: string;
    requiredSkills: string[];
    preferredSkills: string[];
    atsKeywords: string[];
  }
): Promise<ResumeContent> {
  const systemPrompt = `You are an expert resume personalization agent.

YOU MAY:
- Reorder information to highlight relevant experience
- Rewrite bullet points to be more impactful and action-oriented
- Improve wording and professional language
- Emphasize relevant experience for the target job
- Select the most relevant projects
- Use job-specific terminology when truthful
- Restructure sections for maximum impact

YOU MUST NOT:
- Invent experience that doesn't exist
- Invent technologies the candidate hasn't used
- Invent projects
- Invent certifications
- Invent employment history
- Invent metrics or numbers
- Claim proficiency not present in the candidate profile
- Add information not in the source data

RULES:
- Each bullet point should start with a strong action verb
- Quantify achievements where the data supports it
- Keep bullet points concise (1-2 lines)
- Tailor the summary to the target role when provided
- Order skills by relevance to the target job
- Only include technologies actually used by the candidate
- Format dates consistently as "MMM YYYY"`;

  const jobContext = jobTarget
    ? `
TARGET JOB:
Title: ${jobTarget.title}
Company: ${jobTarget.company}
Required Skills: ${jobTarget.requiredSkills.join(", ")}
Preferred Skills: ${jobTarget.preferredSkills.join(", ")}
ATS Keywords to incorporate naturally: ${jobTarget.atsKeywords.join(", ")}

Job Description:
${jobTarget.description}

Generate a tailored version of the resume optimized for this specific job.`
    : `
Generate a strong general-purpose resume.`;

  const userMessage = `Create a professionally written resume based on this candidate data.

CANDIDATE DATA:
Name: ${candidateData.fullName}
Email: ${candidateData.email}
${candidateData.phone ? `Phone: ${candidateData.phone}` : ""}
${candidateData.city ? `Location: ${candidateData.city}` : ""}
${candidateData.linkedin ? `LinkedIn: ${candidateData.linkedin}` : ""}
${candidateData.github ? `GitHub: ${candidateData.github}` : ""}
${candidateData.portfolio ? `Portfolio: ${candidateData.portfolio}` : ""}
${candidateData.summary ? `Current Summary: ${candidateData.summary}` : ""}

EXPERIENCE:
${candidateData.experiences
  .map(
    (exp) => `
- ${exp.title} at ${exp.company}, ${exp.location || "N/A"}
  ${exp.startDate} - ${exp.isCurrent ? "Present" : exp.endDate || "N/A"}
  Highlights: ${exp.highlights.join("; ")}
  Technologies: ${exp.technologies.join(", ")}
`
  )
  .join("\n")}

EDUCATION:
${candidateData.education
  .map(
    (edu) => `
- ${edu.degree} in ${edu.fieldOfStudy || "N/A"}, ${edu.institution}
  ${edu.startDate || ""} - ${edu.endDate || ""}
  ${edu.gpa ? `GPA: ${edu.gpa}` : ""}
`
  )
  .join("\n")}

SKILLS:
${candidateData.skills.map((s) => `${s.name} (${s.category || "general"}, level ${s.proficiencyLevel || 3}/5)`).join(", ")}

PROJECTS:
${candidateData.projects
  .map(
    (p) => `
- ${p.name}: ${p.description || "N/A"}
  Technologies: ${p.technologies.join(", ")}
  ${p.highlights.join("; ")}
`
  )
  .join("\n")}

CERTIFICATIONS:
${candidateData.certifications.map((c) => `${c.name} (${c.issuer || "N/A"})`).join(", ") || "None"}

LANGUAGES:
${candidateData.languages.map((l) => `${l.name} (${l.level || "proficient"})`).join(", ") || "Not specified"}

${jobContext}

Respond with this exact JSON structure:
{
  "personalInfo": {
    "name": "...",
    "email": "...",
    "phone": "...",
    "city": "...",
    "linkedin": "...",
    "github": "...",
    "portfolio": "..."
  },
  "summary": "Professional summary (3-4 sentences)",
  "experience": [
    {
      "company": "...",
      "title": "...",
      "location": "...",
      "startDate": "MMM YYYY",
      "endDate": "MMM YYYY or null",
      "highlights": ["bullet1", "bullet2"],
      "technologies": ["tech1", "tech2"]
    }
  ],
  "education": [
    {
      "institution": "...",
      "degree": "...",
      "fieldOfStudy": "...",
      "startDate": "MMM YYYY",
      "endDate": "MMM YYYY",
      "gpa": "..."
    }
  ],
  "skills": ["skill1", "skill2"],
  "projects": [
    {
      "name": "...",
      "description": "...",
      "url": "...",
      "technologies": ["..."],
      "highlights": ["..."]
    }
  ],
  "certifications": [
    { "name": "...", "issuer": "...", "date": "..." }
  ],
  "languages": [
    { "name": "...", "level": "..." }
  ]
}`;

  const { data } = await routeAIJSON<ResumeContent>("resume_generation", systemPrompt, userMessage, {
    maxTokens: 4096,
    temperature: 0.3,
  });

  return data;
}