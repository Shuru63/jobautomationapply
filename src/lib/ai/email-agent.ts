import { routeAIJSON } from "./router";

export type EmailClassification = {
  isJobRelated: boolean;
  category: "interview_invite" | "rejection" | "offer" | "acknowledgment" | "assessment" | "follow_up" | "other";
  company: string | null;
  role: string | null;
  action: "update_status" | "schedule_interview" | "prepare_interview" | "no_action";
  confidence: number;
  summary: string;
};

export async function classifyJobEmail(
  subject: string,
  from: string,
  body: string
): Promise<EmailClassification> {
  const systemPrompt = `You are an expert at classifying job-related emails. Analyze the email and extract structured information.

CLASSIFICATION CATEGORIES:
- interview_invite: Email inviting to an interview
- rejection: Rejection email
- offer: Job offer
- acknowledgment: Application received/acknowledged
- assessment: Technical assessment or coding challenge
- follow_up: Follow-up from recruiter or HR
- other: Not job-related or unclear

ACTIONS:
- update_status: Update application status in the system
- schedule_interview: Create an interview entry
- prepare_interview: Trigger interview preparation
- no_action: No system action needed`;

  const userMessage = `Classify this email:

FROM: ${from}
SUBJECT: ${subject}

BODY:
${body.substring(0, 2000)}

Respond with this exact JSON:
{
  "isJobRelated": boolean,
  "category": "interview_invite" | "rejection" | "offer" | "acknowledgment" | "assessment" | "follow_up" | "other",
  "company": "extracted company name or null",
  "role": "extracted role/title or null",
  "action": "update_status" | "schedule_interview" | "prepare_interview" | "no_action",
  "confidence": 0.0 to 1.0,
  "summary": "Brief summary of what the email says"
}`;

  const { data } = await routeAIJSON<EmailClassification>("email_classify", systemPrompt, userMessage, {
    maxTokens: 512,
    temperature: 0.1,
  });

  return data;
}