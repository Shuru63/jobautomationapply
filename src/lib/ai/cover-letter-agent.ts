import { routeAI } from "./router";

export async function generateCoverLetter(
  candidateData: {
    fullName: string;
    summary?: string;
    experienceYears: number;
    keySkills: string[];
    targetRole: string;
    highlights: string[];
  },
  jobData: {
    title: string;
    company: string;
    description: string;
    location?: string;
  },
  resumeHighlights?: string[]
): Promise<string> {
  const systemPrompt = `You are an expert cover letter writer. Write a compelling, professional cover letter.

RULES:
- Keep it to 3-4 paragraphs (250-350 words)
- Address the hiring manager professionally
- Open with enthusiasm for the specific role
- Highlight the most relevant experience and skills
- Show knowledge of the company/role
- Close with a clear call to action
- Be professional but personable
- Use ONLY verified facts from the candidate's profile
- Do NOT invent experience, metrics, or achievements
- Do NOT use generic filler phrases excessively
- Match the tone to the company culture when possible`;

  const userMessage = `Write a cover letter for this application.

CANDIDATE:
Name: ${candidateData.fullName}
${candidateData.summary ? `Summary: ${candidateData.summary}` : ""}
Experience: ${candidateData.experienceYears} years
Key Skills: ${candidateData.keySkills.join(", ")}
Career Highlights: ${candidateData.highlights.join("; ")}

JOB:
Title: ${jobData.title}
Company: ${jobData.company}
${jobData.location ? `Location: ${jobData.location}` : ""}

Job Description:
${jobData.description}

${resumeHighlights?.length ? `Resume Highlights to reference:\n${resumeHighlights.join("\n")}` : ""}

Write the cover letter content only. No headers, no "Dear Hiring Manager" salutation format markers - just the letter text with proper paragraph breaks.`;

  const response = await routeAI("cover_letter", systemPrompt, userMessage, {
    maxTokens: 1024,
    temperature: 0.4,
  });

  return response.content;
}