import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateResumePDF, generateResumeDOCX } from "@/lib/documents/resume-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "pdf"; // pdf or docx

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.candidateId, user.profileId)),
  });

  if (!resume || !resume.content) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const content = resume.content as {
    personalInfo: { name: string; email: string; phone?: string; city?: string; linkedin?: string; github?: string; portfolio?: string };
    summary: string;
    experience: Array<{ company: string; title: string; location?: string; startDate: string; endDate?: string; highlights: string[]; technologies?: string[] }>;
    education: Array<{ institution: string; degree: string; fieldOfStudy?: string; startDate?: string; endDate?: string; gpa?: string }>;
    skills: string[];
    projects?: Array<{ name: string; description?: string; url?: string; technologies?: string[]; highlights?: string[] }>;
    certifications?: Array<{ name: string; issuer?: string; date?: string }>;
    languages?: Array<{ name: string; level?: string }>;
  };

  try {
    if (format === "docx") {
      const buffer = await generateResumeDOCX(content);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${resume.title.replace(/[^a-zA-Z0-9]/g, "_")}.docx"`,
        },
      });
    } else {
      const buffer = await generateResumePDF(content);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${resume.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}