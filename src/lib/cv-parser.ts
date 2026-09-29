import { routeAIJSON } from "./ai/router";

export type ParsedCV = {
  personal: {
    name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    country: string;
    linkedin: string;
    github: string;
    portfolio: string;
    twitter: string;
    website: string;
    address: string;
  };
  headline: string;
  summary: string;
  objective: string;
  skills: Array<{ name: string; category: string; proficiency: number }>;
  experience: Array<{
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    highlights: string[];
    technologies: string[];
    description: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    gpa: string;
    honors: string;
    activities: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    url: string;
    repositoryUrl: string;
    technologies: string[];
    highlights: string[];
    startDate: string;
    endDate: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date: string;
    expiryDate: string;
    credentialId: string;
    url: string;
  }>;
  languages: Array<{
    name: string;
    proficiencyLevel: string;
  }>;
  awards: Array<{
    title: string;
    issuer: string;
    date: string;
    description: string;
  }>;
  publications: Array<{
    title: string;
    publisher: string;
    date: string;
    url: string;
    description: string;
  }>;
  volunteer: Array<{
    organization: string;
    role: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  interests: string[];
  references: Array<{
    name: string;
    title: string;
    company: string;
    contact: string;
  }>;
};

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Polyfill for Node.js 21+ / Next.js server environments to prevent pdf.js from crashing
  if (typeof globalThis.DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {};
  }
  if (typeof globalThis.Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D {};
  }
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as any).ImageData = class ImageData {};
  }

  // Use dynamic require to avoid build-time issues
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractTextFromCV(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (
    mimeType === "application/pdf" ||
    mimeType.endsWith(".pdf")
  ) {
    return extractTextFromPDF(buffer);
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    mimeType.endsWith(".docx") ||
    mimeType.endsWith(".doc")
  ) {
    return extractTextFromDOCX(buffer);
  }
  return buffer.toString("utf-8");
}

export async function parseCVWithAI(cvText: string): Promise<ParsedCV> {
  const systemPrompt = `You are an elite CV/resume parser with expertise in handling ALL resume formats from around the world.

CORE RULES:
- Handle ANY format: chronological, functional, combination, academic CVs, portfolio resumes, infographic resumes, international CVs
- Extract EVERY piece of information present — do not skip sections
- Do NOT invent or hallucinate any information not present in the CV
- Use empty string "" for missing text fields, empty array [] for missing array fields
- Normalize all dates to "YYYY-MM" format (e.g. "Jan 2020" → "2020-01", "2020" → "2020-01")
- If only year is available, use "YYYY-01"
- Mark isCurrent=true when end date is "Present", "Current", "Now", "Till date" or missing for an active job
- Skill proficiency (1=beginner, 2=basic, 3=intermediate, 4=advanced, 5=expert) — infer from context, years of use, or keywords like "proficient", "expert", "familiar"
- Categorize skills into: programming, framework, database, cloud, devops, tool, design, soft_skill, domain, other
- Extract ALL bullet points and descriptions as highlights — do not truncate
- For references listed as "Available on request", skip them
- Parse international phone numbers, multi-line addresses, non-English names correctly
- Handle creative layouts: tables, columns, sidebars — extract ALL content regardless of visual layout`;

  const userMessage = `Parse this complete CV/resume and extract every piece of information:

${cvText.substring(0, 12000)}

Return this exact JSON structure (include ALL sections even if empty):
{
  "personal": {
    "name": "",
    "email": "",
    "phone": "",
    "city": "",
    "state": "",
    "country": "",
    "linkedin": "",
    "github": "",
    "portfolio": "",
    "twitter": "",
    "website": "",
    "address": ""
  },
  "headline": "",
  "summary": "",
  "objective": "",
  "skills": [
    { "name": "", "category": "programming|framework|database|cloud|devops|tool|design|soft_skill|domain|other", "proficiency": 3 }
  ],
  "experience": [
    {
      "company": "",
      "title": "",
      "location": "",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or null",
      "isCurrent": false,
      "description": "",
      "highlights": ["bullet point 1", "bullet point 2"],
      "technologies": ["tech1", "tech2"]
    }
  ],
  "education": [
    {
      "institution": "",
      "degree": "",
      "fieldOfStudy": "",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM",
      "gpa": "",
      "honors": "",
      "activities": ""
    }
  ],
  "projects": [
    {
      "name": "",
      "description": "",
      "url": "",
      "repositoryUrl": "",
      "technologies": [],
      "highlights": [],
      "startDate": "",
      "endDate": ""
    }
  ],
  "certifications": [
    {
      "name": "",
      "issuer": "",
      "date": "",
      "expiryDate": "",
      "credentialId": "",
      "url": ""
    }
  ],
  "languages": [
    { "name": "", "proficiencyLevel": "native|fluent|intermediate|basic" }
  ],
  "awards": [
    { "title": "", "issuer": "", "date": "", "description": "" }
  ],
  "publications": [
    { "title": "", "publisher": "", "date": "", "url": "", "description": "" }
  ],
  "volunteer": [
    { "organization": "", "role": "", "startDate": "", "endDate": "", "description": "" }
  ],
  "interests": ["interest1", "interest2"],
  "references": [
    { "name": "", "title": "", "company": "", "contact": "" }
  ]
}`;

  const { data } = await routeAIJSON<ParsedCV>(
    "cv_parsing",
    systemPrompt,
    userMessage,
    {
      maxTokens: 8192,
      temperature: 0.1,
    }
  );

  // Ensure all required fields exist with safe defaults
  return {
    personal: {
      name: data.personal?.name || "",
      email: data.personal?.email || "",
      phone: data.personal?.phone || "",
      city: data.personal?.city || "",
      state: data.personal?.state || "",
      country: data.personal?.country || "",
      linkedin: data.personal?.linkedin || "",
      github: data.personal?.github || "",
      portfolio: data.personal?.portfolio || "",
      twitter: data.personal?.twitter || "",
      website: data.personal?.website || "",
      address: data.personal?.address || "",
    },
    headline: data.headline || "",
    summary: data.summary || "",
    objective: data.objective || "",
    skills: data.skills || [],
    experience: (data.experience || []).map(e => ({
      company: e.company || "",
      title: e.title || "",
      location: e.location || "",
      startDate: e.startDate || "",
      endDate: e.endDate || null,
      isCurrent: e.isCurrent || false,
      highlights: e.highlights || [],
      technologies: e.technologies || [],
      description: e.description || "",
    })),
    education: (data.education || []).map(e => ({
      institution: e.institution || "",
      degree: e.degree || "",
      fieldOfStudy: e.fieldOfStudy || "",
      startDate: e.startDate || "",
      endDate: e.endDate || "",
      gpa: e.gpa || "",
      honors: e.honors || "",
      activities: e.activities || "",
    })),
    projects: (data.projects || []).map(p => ({
      name: p.name || "",
      description: p.description || "",
      url: p.url || "",
      repositoryUrl: p.repositoryUrl || "",
      technologies: p.technologies || [],
      highlights: p.highlights || [],
      startDate: p.startDate || "",
      endDate: p.endDate || "",
    })),
    certifications: (data.certifications || []).map(c => ({
      name: c.name || "",
      issuer: c.issuer || "",
      date: c.date || "",
      expiryDate: c.expiryDate || "",
      credentialId: c.credentialId || "",
      url: c.url || "",
    })),
    languages: data.languages || [],
    awards: data.awards || [],
    publications: data.publications || [],
    volunteer: data.volunteer || [],
    interests: data.interests || [],
    references: data.references || [],
  };
}