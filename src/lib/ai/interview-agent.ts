import { routeAIJSON } from "./router";

export type InterviewPrepResult = {
  companyResearch: string;
  roleAnalysis: string;
  technicalTopics: string[];
  behavioralQuestions: string[];
  technicalQuestions: string[];
  projectQuestions: string[];
  questionsToAsk: string[];
  resumeTopics: string[];
  tips: string[];
};

export async function generateInterviewPrep(
  candidateProfile: {
    fullName: string;
    summary?: string;
    skills: string[];
    experienceYears: number;
    experienceSummary: string;
    projects: string;
    education: string;
  },
  jobData: {
    title: string;
    company: string;
    description: string;
    requiredSkills: string[];
    location?: string;
  },
  interviewRound: string
): Promise<InterviewPrepResult> {
  const systemPrompt = `You are an expert interview preparation coach. Generate comprehensive interview preparation material based on the candidate's profile, the job requirements, and the interview round.

RULES:
- Tailor everything to the specific company and role
- Base questions on real interview patterns for this type of role
- Reference the candidate's actual experience and projects
- Provide practical, actionable tips
- Include a mix of difficulty levels
- Focus on the specific interview round type`;

  const userMessage = `Generate interview preparation for:

CANDIDATE:
Name: ${candidateProfile.fullName}
${candidateProfile.summary ? `Summary: ${candidateProfile.summary}` : ""}
Experience: ${candidateProfile.experienceYears} years
Experience Details: ${candidateProfile.experienceSummary}
Skills: ${candidateProfile.skills.join(", ")}
Projects: ${candidateProfile.projects}
Education: ${candidateProfile.education}

JOB:
Title: ${jobData.title}
Company: ${jobData.company}
${jobData.location ? `Location: ${jobData.location}` : ""}
Required Skills: ${jobData.requiredSkills.join(", ")}

Job Description:
${jobData.description}

Interview Round: ${interviewRound}

Respond with this exact JSON:
{
  "companyResearch": "Key facts about the company, culture, recent news, products (3-4 paragraphs)",
  "roleAnalysis": "Analysis of the role requirements and how the candidate matches (2-3 paragraphs)",
  "technicalTopics": ["topic1", "topic2", ...],
  "behavioralQuestions": ["question1", "question2", ...],
  "technicalQuestions": ["question1", "question2", ...],
  "projectQuestions": ["question1 about their projects", ...],
  "questionsToAsk": ["question for interviewer 1", ...],
  "resumeTopics": ["topics they might be asked about from their resume", ...],
  "tips": ["tip1", "tip2", ...]
}`;

  const { data } = await routeAIJSON<InterviewPrepResult>("interview_prep", systemPrompt, userMessage, {
    maxTokens: 4096,
    temperature: 0.3,
  });

  return data;
}