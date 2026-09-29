import { routeAI } from "./router";

export type QuestionAnswer = {
  question: string;
  answer: string;
  isFromProfile: boolean;
  confidence: number;
};

export async function answerApplicationQuestion(
  question: string,
  questionType: string,
  maxLength: number | undefined,
  candidateProfile: {
    fullName: string;
    summary?: string;
    experienceYears: number;
    skills: string[];
    currentCompany?: string;
    currentTitle?: string;
    location?: string;
    expectedSalaryMin?: number;
    expectedSalaryMax?: number;
    noticePeriod?: string;
    workAuthorization?: string;
    education: string;
    highlights: string[];
  },
  jobContext?: {
    title: string;
    company: string;
    description: string;
  }
): Promise<QuestionAnswer> {
  const systemPrompt = `You are an expert at answering job application questions accurately based on candidate profile data.

RULES:
- If the answer can be directly found in the profile, use that exact information
- If the question requires subjective input, generate a professional draft answer
- Never fabricate qualifications, experience, or credentials
- Be concise and direct
- Match the expected format (yes/no, number, short text, paragraph)
- If you cannot confidently answer, indicate low confidence

COMMON QUESTION MAPPINGS:
- "notice period" → check profile for notice period, default to "Immediate" or "2 weeks"
- "years of experience" → use exact years from profile
- "current CTC/salary" → use profile data or indicate "Not specified"
- "expected CTC/salary" → use salary preferences from profile
- "work authorization" → use profile data
- "willing to relocate" → use profile preference
- "start date" → use "Immediately" or "2 weeks notice"`;

  const maxLen = maxLength || 500;

  const userMessage = `Answer this application question based on the candidate's profile.

QUESTION: ${question}
QUESTION TYPE: ${questionType}
MAX LENGTH: ${maxLen} characters

CANDIDATE PROFILE:
Name: ${candidateProfile.fullName}
${candidateProfile.summary ? `Summary: ${candidateProfile.summary}` : ""}
Experience: ${candidateProfile.experienceYears} years
${candidateProfile.currentTitle ? `Current Title: ${candidateProfile.currentTitle}` : ""}
${candidateProfile.currentCompany ? `Current Company: ${candidateProfile.currentCompany}` : ""}
${candidateProfile.location ? `Location: ${candidateProfile.location}` : ""}
Skills: ${candidateProfile.skills.join(", ")}
Education: ${candidateProfile.education}
${candidateProfile.expectedSalaryMin ? `Expected Salary: ${candidateProfile.expectedSalaryMin}-${candidateProfile.expectedSalaryMax || "open"}` : ""}
${candidateProfile.noticePeriod ? `Notice Period: ${candidateProfile.noticePeriod}` : ""}
${candidateProfile.workAuthorization ? `Work Authorization: ${candidateProfile.workAuthorization}` : ""}
Key Highlights: ${candidateProfile.highlights.join("; ")}

${jobContext ? `JOB CONTEXT:\nTitle: ${jobContext.title}\nCompany: ${jobContext.company}\nDescription: ${jobContext.description}` : ""}

Respond with this exact JSON structure:
{
  "question": "the question",
  "answer": "your answer (keep under ${maxLen} characters)",
  "isFromProfile": true if answer comes directly from profile data, false if generated,
  "confidence": 0.0 to 1.0
}`;

  const response = await routeAI("question_answer", systemPrompt, userMessage, {
    maxTokens: 1024,
    temperature: 0.2,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return {
      question,
      answer: response.content,
      isFromProfile: false,
      confidence: 0.5,
    };
  }
}