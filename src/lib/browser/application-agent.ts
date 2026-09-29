import type { Page } from "playwright";
import { getBrowserManager } from "./manager";
import { detectApplicationForm, type CaptchaDetection } from "./form-detector";
import { mapFieldsToProfile, fillForm, uploadFile, submitForm } from "./form-filler";
import { db } from "@/db";
import { applications, applicationEvents, applicationQuestions, applicationAnswers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { answerApplicationQuestion } from "@/lib/ai/question-agent";

export type ApplicationResult = {
  success: boolean;
  status: "pending_review" | "submitted" | "captcha_paused" | "mfa_paused" | "rejected";
  screenshotUrl?: string;
  failureReason?: string;
  detectedQuestions: Array<{ question: string; type: string; selector: string }>;
  captcha?: CaptchaDetection;
  formFields?: Record<string, string>;
};

export async function prepareAndFillApplication(
  applicationId: string,
  candidateId: string,
  profile: {
    fullName: string;
    email: string;
    phone?: string;
    city?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    summary?: string;
    experienceYears: number;
    currentTitle?: string;
    currentCompany?: string;
    expectedSalary?: number;
    skills: string[];
    education: string;
    highlights: string[];
  },
  jobUrl: string,
  resumePath?: string
): Promise<ApplicationResult> {
  const bm = getBrowserManager();
  const page = await bm.newPage();

  try {
    // Log event
    await logEvent(applicationId, "navigation_start", `Navigating to ${jobUrl}`);

    // Navigate to job URL
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Take initial screenshot
    const initialScreenshot = await bm.takeScreenshot(page, candidateId, `app-${applicationId}-initial`);

    // Detect form
    const form = await detectApplicationForm(page);

    // Log detected fields
    await logEvent(applicationId, "form_detected", `Detected ${form.fields.length} form fields`, {
      fields: form.fields.map((f) => ({ label: f.label, type: f.type })),
    });

    // Check for CAPTCHA
    if (form.captcha.detected) {
      const captchaScreenshot = await bm.takeScreenshot(page, candidateId, `app-${applicationId}-captcha`);
      await logEvent(applicationId, "captcha_detected", `CAPTCHA detected: ${form.captcha.type}`, {
        captchaType: form.captcha.type,
        screenshot: captchaScreenshot,
      });

      // Update application status
      await db.update(applications).set({
        status: "pending_review",
        screenshotUrl: captchaScreenshot,
        failureReason: `CAPTCHA detected (${form.captcha.type}). Manual intervention required.`,
        updatedAt: new Date(),
      }).where(eq(applications.id, applicationId));

      return {
        success: false,
        status: "captcha_paused",
        screenshotUrl: captchaScreenshot,
        failureReason: `CAPTCHA detected: ${form.captcha.type}`,
        detectedQuestions: [],
        captcha: form.captcha,
      };
    }

    // Map fields to profile data
    const mappings = mapFieldsToProfile(form.fields, profile);
    const formFieldValues: Record<string, string> = {};
    for (const m of mappings) {
      formFieldValues[m.selector] = m.value;
    }

    // Fill form
    await fillForm(page, mappings);

    // Upload resume if file upload detected and we have a file
    if (form.hasFileUpload && resumePath) {
      const fileInput = form.fields.find((f) => f.type === "file");
      if (fileInput) {
        await uploadFile(page, fileInput.selector, resumePath);
        await logEvent(applicationId, "resume_uploaded", `Resume uploaded to ${fileInput.selector}`);
      }
    }

    // Detect and store questions
    const questions = form.fields.filter(
      (f) =>
        (f.type === "textarea" || f.type === "text") &&
        (f.label.toLowerCase().includes("why") ||
          f.label.toLowerCase().includes("describe") ||
          f.label.toLowerCase().includes("tell us") ||
          f.label.toLowerCase().includes("explain") ||
          f.label.toLowerCase().includes("motivation") ||
          f.label.toLowerCase().includes("interest"))
    );

    const detectedQuestions: Array<{ question: string; type: string; selector: string }> = [];

    for (const q of questions) {
      // Store question in DB
      const questionId = crypto.randomUUID();
      await db.insert(applicationQuestions).values({
        id: questionId,
        applicationId,
        questionText: q.label || q.placeholder,
        questionType: q.type,
        isRequired: q.required,
      });

      detectedQuestions.push({
        question: q.label || q.placeholder,
        type: q.type,
        selector: q.selector,
      });

      // Try to auto-answer with AI
      try {
        const answerResult = await answerApplicationQuestion(
          q.label || q.placeholder,
          q.type,
          500,
          {
            fullName: profile.fullName,
            summary: profile.summary,
            experienceYears: profile.experienceYears,
            skills: profile.skills,
            currentCompany: profile.currentCompany,
            currentTitle: profile.currentTitle,
            location: profile.city,
            expectedSalaryMin: profile.expectedSalary,
            education: profile.education,
            highlights: profile.highlights,
          }
        );

        // Store answer
        await db.insert(applicationAnswers).values({
          id: crypto.randomUUID(),
          questionId,
          applicationId,
          answerText: answerResult.answer,
          aiGenerated: true,
          reviewed: false,
          approved: false,
        });

        // Fill answer in form
        await page.locator(q.selector).first().fill(answerResult.answer).catch(() => {});
      } catch (err) {
        console.error("Failed to answer question:", err);
      }
    }

    // Take filled form screenshot
    const filledScreenshot = await bm.takeScreenshot(page, candidateId, `app-${applicationId}-filled`);

    // Update application
    await db.update(applications).set({
      formFields: formFieldValues,
      screenshotUrl: filledScreenshot,
      status: "pending_review",
      updatedAt: new Date(),
    }).where(eq(applications.id, applicationId));

    await logEvent(applicationId, "form_filled", `Form filled with ${mappings.length} fields, ${detectedQuestions.length} questions detected`);

    return {
      success: true,
      status: "pending_review",
      screenshotUrl: filledScreenshot,
      detectedQuestions,
      formFields: formFieldValues,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorScreenshot = await bm.takeScreenshot(page, candidateId, `app-${applicationId}-error`).catch(() => "");

    await db.update(applications).set({
      status: "rejected",
      failureReason: errorMessage,
      screenshotUrl: errorScreenshot,
      updatedAt: new Date(),
    }).where(eq(applications.id, applicationId));

    await logEvent(applicationId, "error", `Application preparation failed: ${errorMessage}`);

    return {
      success: false,
      status: "rejected",
      failureReason: errorMessage,
      screenshotUrl: errorScreenshot,
      detectedQuestions: [],
    };
  } finally {
    await page.close();
  }
}

export async function submitApplication(
  applicationId: string,
  candidateId: string,
  jobUrl: string,
  approved: boolean
): Promise<ApplicationResult> {
  if (!approved) {
    return { success: false, status: "pending_review", detectedQuestions: [] };
  }

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: { questions: true },
  });

  if (!app) {
    return { success: false, status: "rejected", failureReason: "Application not found", detectedQuestions: [] };
  }

  const bm = getBrowserManager();
  const page = await bm.newPage();

  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Re-detect form
    const form = await detectApplicationForm(page);

    // Check CAPTCHA again
    if (form.captcha.detected) {
      return {
        success: false,
        status: "captcha_paused",
        failureReason: `CAPTCHA detected: ${form.captcha.type}`,
        captcha: form.captcha,
        detectedQuestions: [],
      };
    }

    // Refill form with saved data
    if (app.formFields) {
      const savedFields = app.formFields as Record<string, string>;
      for (const [selector, value] of Object.entries(savedFields)) {
        await page.locator(selector).first().fill(String(value)).catch(() => {});
      }
    }

    // Submit
    const submitted = await submitForm(page, form.submitSelector);

    if (submitted) {
      const submitScreenshot = await bm.takeScreenshot(page, candidateId, `app-${applicationId}-submitted`);

      await db.update(applications).set({
        status: "submitted",
        appliedAt: new Date(),
        screenshotUrl: submitScreenshot,
        updatedAt: new Date(),
      }).where(eq(applications.id, applicationId));

      await logEvent(applicationId, "submitted", "Application submitted successfully");

      return {
        success: true,
        status: "submitted",
        screenshotUrl: submitScreenshot,
        detectedQuestions: [],
      };
    }

    return {
      success: false,
      status: "rejected",
      failureReason: "Submit button not found",
      detectedQuestions: [],
    };
  } catch (err) {
    return {
      success: false,
      status: "rejected",
      failureReason: err instanceof Error ? err.message : "Submission failed",
      detectedQuestions: [],
    };
  } finally {
    await page.close();
  }
}

async function logEvent(
  applicationId: string,
  eventType: string,
  description: string,
  metadata?: Record<string, unknown>
) {
  await db.insert(applicationEvents).values({
    id: crypto.randomUUID(),
    applicationId,
    eventType,
    description,
    metadata: metadata || {},
  }).catch((err) => console.error("Failed to log event:", err));
}