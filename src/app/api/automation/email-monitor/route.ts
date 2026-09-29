import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { applications, companies, interviews, applicationEvents } from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { classifyJobEmail } from "@/lib/ai/email-agent";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { subject, from, body: emailBody } = body;

  if (!subject || !from || !emailBody) {
    return NextResponse.json({ error: "Subject, from, and body are required" }, { status: 400 });
  }

  try {
    const classification = await classifyJobEmail(subject, from, emailBody);

    if (!classification.isJobRelated) {
      return NextResponse.json({ classification, matched: false });
    }

    // Try to match with an existing application
    let matchedApplication = null;
    if (classification.company) {
      // Find company
      const company = await db.query.companies.findFirst({
        where: ilike(companies.name, `%${classification.company}%`),
      });

      if (company) {
        // Find applications for this company
        const apps = await db.query.applications.findMany({
          where: eq(applications.candidateId, user.profileId),
          with: { job: true },
        });

        matchedApplication = apps.find((a) => a.job?.companyId === company.id);
      }
    }

    if (matchedApplication) {
      // Update application status based on email classification
      let newStatus = matchedApplication.status;

      switch (classification.category) {
        case "interview_invite":
          newStatus = "interview";
          // Create interview entry
          await db.insert(interviews).values({
            id: crypto.randomUUID(),
            applicationId: matchedApplication.id,
            roundNumber: 1,
            roundType: "general",
            status: "scheduled",
          });
          break;
        case "rejection":
          newStatus = "rejected";
          break;
        case "offer":
          newStatus = "offer";
          break;
        case "acknowledgment":
          if (matchedApplication.status === "submitted") newStatus = "viewed";
          break;
      }

      if (newStatus !== matchedApplication.status) {
        await db.update(applications).set({
          status: newStatus,
          updatedAt: new Date(),
        }).where(eq(applications.id, matchedApplication.id));

        await db.insert(applicationEvents).values({
          id: crypto.randomUUID(),
          applicationId: matchedApplication.id,
          eventType: "email_received",
          description: `Status updated to ${newStatus} based on email: ${classification.summary}`,
          metadata: { emailClassification: classification },
        });
      }

      return NextResponse.json({
        classification,
        matched: true,
        applicationId: matchedApplication.id,
        newStatus,
      });
    }

    return NextResponse.json({
      classification,
      matched: false,
      message: "Could not match email to an existing application",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Email processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}