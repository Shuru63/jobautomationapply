import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import {
  candidateProfiles,
  experiences,
  education,
  skills,
  projects,
  certifications,
  languages,
  documents,
  aiGenerations,
  automationRuns,
  automationEvents,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { saveFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("cv") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    const isPDF = file.name.endsWith(".pdf");
    const isDOCX = file.name.endsWith(".docx") || file.name.endsWith(".doc");

    if (!allowedTypes.includes(file.type) && !isPDF && !isDOCX) {
      return NextResponse.json(
        { error: "Only PDF and DOCX files are supported" },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save file
    const { fileUrl, filePath } = await saveFile(buffer, file.name, "resumes");

    // Save document record
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      candidateId: user.profileId,
      type: "resume",
      name: file.name,
      fileUrl,
      fileSize: buffer.length,
      mimeType: file.type,
    });

    // Extract text from CV
    const { extractTextFromCV, parseCVWithAI } = await import("@/lib/cv-parser");
    const cvText = await extractTextFromCV(buffer, file.type || (isPDF ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

    if (!cvText || cvText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract enough text from the CV. Please try a different file." },
        { status: 400 }
      );
    }

    // Parse CV with AI
    const parsed = await (await import("@/lib/cv-parser")).parseCVWithAI(cvText);

    // Save parsed data to profile
    await db
      .update(candidateProfiles)
      .set({
        phone: parsed.personal.phone || null,
        city: parsed.personal.city || null,
        state: parsed.personal.state || null,
        country: parsed.personal.country || "India",
        linkedinUrl: parsed.personal.linkedin || null,
        githubUrl: parsed.personal.github || null,
        portfolioUrl: parsed.personal.portfolio || parsed.personal.website || null,
        websiteUrl: parsed.personal.website || parsed.personal.portfolio || null,
        professionalSummary: parsed.summary || parsed.objective || null,
        headline: parsed.headline || null,
        updatedAt: new Date(),
      })
      .where(eq(candidateProfiles.id, user.profileId));

    // Clear existing data before inserting parsed data
    await db.delete(experiences).where(eq(experiences.candidateId, user.profileId));
    await db.delete(education).where(eq(education.candidateId, user.profileId));
    await db.delete(skills).where(eq(skills.candidateId, user.profileId));
    await db.delete(projects).where(eq(projects.candidateId, user.profileId));
    await db.delete(certifications).where(eq(certifications.candidateId, user.profileId));
    await db.delete(languages).where(eq(languages.candidateId, user.profileId));

    // Insert experiences
    for (const exp of parsed.experience) {
      if (!exp.company && !exp.title) continue; // skip empty entries
      let startDate: Date;
      try { startDate = new Date((exp.startDate || "2000-01") + "-01"); } catch { startDate = new Date("2000-01-01"); }
      let endDate: Date | null = null;
      if (exp.endDate) { try { endDate = new Date(exp.endDate + "-01"); } catch { endDate = null; } }
      await db.insert(experiences).values({
        id: crypto.randomUUID(),
        candidateId: user.profileId,
        company: exp.company,
        title: exp.title,
        location: exp.location || null,
        startDate,
        endDate,
        isCurrent: exp.isCurrent || false,
        highlights: exp.highlights || [],
        technologies: exp.technologies || [],
        description: exp.description || null,
      });
    }

    // Insert education
    for (const edu of parsed.education) {
      if (!edu.institution && !edu.degree) continue;
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      try { if (edu.startDate) startDate = new Date(edu.startDate + "-01"); } catch { /* skip */ }
      try { if (edu.endDate) endDate = new Date(edu.endDate + "-01"); } catch { /* skip */ }
      await db.insert(education).values({
        id: crypto.randomUUID(),
        candidateId: user.profileId,
        institution: edu.institution,
        degree: edu.degree,
        fieldOfStudy: edu.fieldOfStudy || null,
        startDate,
        endDate,
        gpa: edu.gpa || null,
        description: edu.honors ? `Honors: ${edu.honors}${edu.activities ? `. Activities: ${edu.activities}` : ""}` : (edu.activities || null),
      });
    }

    // Insert skills
    for (const skill of parsed.skills) {
      await db.insert(skills).values({
        id: crypto.randomUUID(),
        candidateId: user.profileId,
        name: skill.name,
        category: skill.category || null,
        proficiencyLevel: skill.proficiency || 3,
      });
    }

    // Insert projects
    for (const proj of parsed.projects) {
      if (!proj.name) continue;
      await db.insert(projects).values({
        id: crypto.randomUUID(),
        candidateId: user.profileId,
        name: proj.name,
        description: proj.description || null,
        url: proj.url || null,
        repositoryUrl: proj.repositoryUrl || null,
        technologies: proj.technologies || [],
        highlights: proj.highlights || [],
      });
    }

    // Insert certifications
    for (const cert of parsed.certifications) {
      if (!cert.name) continue;
      let issueDate: Date | null = null;
      try { if (cert.date) issueDate = new Date(cert.date); } catch { /* skip */ }
      let expiryDate: Date | null = null;
      try { if (cert.expiryDate) expiryDate = new Date(cert.expiryDate); } catch { /* skip */ }
      await db.insert(certifications).values({
        id: crypto.randomUUID(),
        candidateId: user.profileId,
        name: cert.name,
        issuer: cert.issuer || null,
        issueDate,
        expiryDate,
        credentialId: cert.credentialId || null,
        credentialUrl: cert.url || null,
      });
    }

    // Insert languages
    for (const lang of parsed.languages) {
      await db.insert(languages).values({
        id: crypto.randomUUID(),
        candidateId: user.profileId,
        name: lang.name,
        proficiencyLevel: lang.proficiencyLevel || "intermediate",
      });
    }

    // Log AI generation
    await db.insert(aiGenerations).values({
      id: crypto.randomUUID(),
      candidateId: user.profileId,
      type: "skill_extraction",
      input: { fileName: file.name, textLength: cvText.length },
      output: {
        skills: parsed.skills.length,
        experiences: parsed.experience.length,
        education: parsed.education.length,
      },
      model: "router-auto",
    });

    // ── Auto-trigger full pipeline now that profile is populated ──
    const pipelineRunId = crypto.randomUUID();
    await db.insert(automationRuns).values({
      id: pipelineRunId,
      candidateId: user.profileId,
      type: "full_pipeline",
      status: "running",
      startedAt: new Date(),
      metadata: {
        triggeredBy: "cv_upload",
        minMatchScore: 77,
        maxApplications: 10,
        autoSubmit: false,
      },
    });
    await db.insert(automationEvents).values({
      id: crypto.randomUUID(),
      runId: pipelineRunId,
      level: "info",
      message: `🚀 Pipeline auto-started after CV upload: ${file.name}`,
    });

    // Fire pipeline in background (don't await — response returns immediately)
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/automation/full-pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
      body: JSON.stringify({
        jobTitles: [],          // AI will decide based on extracted skills
        locations: [parsed.personal.city, parsed.personal.country].filter(Boolean),
        remoteOnly: false,
        maxApplications: 10,
        autoSubmit: false,     // Queue for review
        minMatchScore: 77,     // Minimum 77% ATS match
      }),
    }).catch(() => {}); // fire-and-forget

    return NextResponse.json({
      success: true,
      pipelineStarted: true,
      pipelineRunId,
      parsed: {
        name: parsed.personal.name,
        email: parsed.personal.email,
        phone: parsed.personal.phone,
        headline: parsed.headline,
        summary: parsed.summary?.substring(0, 150),
        skillsCount: parsed.skills.length,
        skills: parsed.skills.slice(0, 10).map((s) => s.name),
        experienceCount: parsed.experience.length,
        educationCount: parsed.education.length,
        projectsCount: parsed.projects.length,
        certificationsCount: parsed.certifications.length,
        languagesCount: parsed.languages.length,
        awardsCount: parsed.awards?.length || 0,
        volunteerCount: parsed.volunteer?.length || 0,
        publicationsCount: parsed.publications?.length || 0,
      },
      message: "CV parsed and job-search pipeline started automatically! Check Automation Pipeline for live progress.",
      fileUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "CV parsing failed";
    console.error("CV upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}