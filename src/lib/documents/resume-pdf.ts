// Dynamic import to avoid build-time issues

export type ResumeData = {
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

function renderResumeHTML(data: ResumeData): string {
  const skillsHTML = data.skills
    .map((s) => {
      if (s.includes(":")) {
        const [cat, ...rest] = s.split(":");
        return `<p style="margin-bottom: 3px; font-size: 11px;"><strong>${cat}:</strong> ${rest.join(":")}</p>`;
      }
      return `<p style="margin-bottom: 3px; font-size: 11px;">${s}</p>`;
    })
    .join("");

  const expHTML = data.experience
    .map(
      (e) => `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-title"><strong>${e.title}</strong></div>
        <div class="date"><strong>${e.startDate} — ${e.endDate || "Present"}</strong></div>
      </div>
      <div class="entry-subtitle"><em>${e.company}${e.location ? ` • ${e.location}` : ""}</em></div>
      ${e.highlights.length ? `<ul>${e.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>` : ""}
      ${e.technologies?.length ? `<div class="tech">Technologies: ${e.technologies.join(", ")}</div>` : ""}
    </div>`
    )
    .join("");

  const eduHTML = data.education
    .map(
      (e) => `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-title">${e.degree}${e.fieldOfStudy ? ` — ${e.fieldOfStudy}` : ""} — ${e.institution}</div>
        <div class="date"><strong>CGPA/GPA: ${e.gpa || "N/A"}</strong></div>
      </div>
    </div>`
    )
    .join("");

  const projectsHTML = (data.projects || [])
    .map(
      (p) => `
    <div class="entry">
      <div class="entry-header">
        <div class="entry-title"><strong>${p.name}</strong>${p.url ? ` — <a href="${p.url}">${p.url}</a>` : ""}</div>
      </div>
      ${p.description ? `<p>${p.description}</p>` : ""}
      ${p.highlights?.length ? `<ul>${p.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>` : ""}
    </div>`
    )
    .join("");

  const contacts = [
    data.personalInfo.email,
    data.personalInfo.phone,
    data.personalInfo.linkedin ? `<a href="${data.personalInfo.linkedin}">LinkedIn</a>` : "",
    data.personalInfo.github ? `<a href="${data.personalInfo.github}">GitHub</a>` : "",
    data.personalInfo.portfolio ? `<a href="${data.personalInfo.portfolio}">Portfolio</a>` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 35px 45px; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; line-height: 1.4; color: #333; }
  a { color: #1e40af; text-decoration: none; }
  .header { text-align: left; margin-bottom: 12px; }
  .header h1 { font-size: 24px; color: #1e3a8a; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .headline { font-size: 12px; color: #4b5563; font-style: italic; margin-bottom: 4px; }
  .header .contacts { font-size: 11px; color: #4b5563; padding-bottom: 8px; border-bottom: 1px solid #93c5fd; }
  .section { margin-bottom: 12px; }
  .section-title { font-size: 12px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #1e3a8a; padding-bottom: 2px; margin-bottom: 6px; }
  .summary { font-size: 11px; text-align: justify; }
  .entry { margin-bottom: 10px; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
  .entry-title { font-size: 11.5px; color: #111827; }
  .entry-subtitle { font-size: 11px; color: #4b5563; margin-bottom: 3px; }
  .date { font-size: 11px; color: #374151; white-space: nowrap; }
  .entry ul { margin: 3px 0 0 16px; padding-left: 4px; }
  .entry li { font-size: 11px; margin-bottom: 3px; text-align: justify; }
  .entry p { font-size: 11px; margin-top: 2px; }
  .tech { font-size: 10.5px; color: #4b5563; margin-top: 2px; font-style: italic; }
</style>
</head>
<body>
  <div class="header">
    <h1>${data.personalInfo.name}</h1>
    ${data.summary ? `<div class="headline">Tailored Application Resume</div>` : ""}
    <div class="contacts">${contacts}</div>
  </div>
  ${data.summary ? `<div class="section"><div class="section-title">Professional Summary</div><div class="summary">${data.summary}</div></div>` : ""}
  ${data.skills.length ? `<div class="section"><div class="section-title">Technical Skills</div><div>${skillsHTML}</div></div>` : ""}
  ${data.experience.length ? `<div class="section"><div class="section-title">Professional Experience</div>${expHTML}</div>` : ""}
  ${data.projects?.length ? `<div class="section"><div class="section-title">Key Projects</div>${projectsHTML}</div>` : ""}
  ${data.education.length ? `<div class="section"><div class="section-title">Education</div>${eduHTML}</div>` : ""}
</body>
</html>`;
}

export async function generateResumePDF(data: ResumeData): Promise<Buffer> {
  const html = renderResumeHTML(data);
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const buffer = await page.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}

export async function generateResumeDOCX(data: ResumeData): Promise<Buffer> {
  // Dynamic import to avoid issues
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [];

  // Header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: data.personalInfo.name, bold: true, size: 32 })],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    })
  );

  const contacts = [
    data.personalInfo.email,
    data.personalInfo.phone,
    data.personalInfo.city,
  ]
    .filter(Boolean)
    .join(" | ");

  children.push(
    new Paragraph({
      children: [new TextRun({ text: contacts, size: 18, color: "666666" })],
      alignment: AlignmentType.CENTER,
    })
  );

  // Summary
  if (data.summary) {
    children.push(new Paragraph({ children: [new TextRun({ text: "PROFESSIONAL SUMMARY", bold: true, size: 22, color: "1e40af" })], spacing: { before: 200 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: data.summary, size: 20 })] }));
  }

  // Skills
  if (data.skills.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: "SKILLS", bold: true, size: 22, color: "1e40af" })], spacing: { before: 200 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: data.skills.join(" · "), size: 20 })] }));
  }

  // Experience
  if (data.experience.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: "EXPERIENCE", bold: true, size: 22, color: "1e40af" })], spacing: { before: 200 } }));
    for (const exp of data.experience) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${exp.title} at ${exp.company}`, bold: true, size: 20 }),
            new TextRun({ text: `  (${exp.startDate} — ${exp.endDate || "Present"})`, size: 18, color: "666666" }),
          ],
        })
      );
      for (const h of exp.highlights) {
        children.push(new Paragraph({ children: [new TextRun({ text: `• ${h}`, size: 19 })], indent: { left: 360 } }));
      }
    }
  }

  // Education
  if (data.education.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: "EDUCATION", bold: true, size: 22, color: "1e40af" })], spacing: { before: 200 } }));
    for (const edu of data.education) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}`, bold: true, size: 20 }),
            new TextRun({ text: ` — ${edu.institution}`, size: 20 }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return await Packer.toBuffer(doc);
}