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
  const skillsHTML = data.skills.map((s) => `<span class="skill">${s}</span>`).join("");
  const expHTML = data.experience
    .map(
      (e) => `
    <div class="entry">
      <div class="entry-header">
        <div><strong>${e.title}</strong> at <strong>${e.company}</strong>${e.location ? ` — ${e.location}` : ""}</div>
        <div class="date">${e.startDate} — ${e.endDate || "Present"}</div>
      </div>
      ${e.highlights.length ? `<ul>${e.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>` : ""}
      ${e.technologies?.length ? `<div class="tech">${e.technologies.join(" · ")}</div>` : ""}
    </div>`
    )
    .join("");

  const eduHTML = data.education
    .map(
      (e) => `
    <div class="entry">
      <div class="entry-header">
        <div><strong>${e.degree}</strong>${e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : ""} — ${e.institution}</div>
        <div class="date">${e.startDate || ""} — ${e.endDate || ""}${e.gpa ? ` | GPA: ${e.gpa}` : ""}</div>
      </div>
    </div>`
    )
    .join("");

  const projectsHTML = (data.projects || [])
    .map(
      (p) => `
    <div class="entry">
      <div class="entry-header">
        <div><strong>${p.name}</strong>${p.url ? ` — <a href="${p.url}">${p.url}</a>` : ""}</div>
      </div>
      ${p.description ? `<p>${p.description}</p>` : ""}
      ${p.highlights?.length ? `<ul>${p.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>` : ""}
      ${p.technologies?.length ? `<div class="tech">${p.technologies.join(" · ")}</div>` : ""}
    </div>`
    )
    .join("");

  const certsHTML = (data.certifications || [])
    .map((c) => `<span class="cert">${c.name}${c.issuer ? ` (${c.issuer})` : ""}</span>`)
    .join("");

  const langsHTML = (data.languages || [])
    .map((l) => `<span class="lang">${l.name}${l.level ? ` — ${l.level}` : ""}</span>`)
    .join("");

  const contacts = [
    data.personalInfo.email,
    data.personalInfo.phone,
    data.personalInfo.city,
    data.personalInfo.linkedin ? `<a href="${data.personalInfo.linkedin}">LinkedIn</a>` : "",
    data.personalInfo.github ? `<a href="${data.personalInfo.github}">GitHub</a>` : "",
    data.personalInfo.portfolio ? `<a href="${data.personalInfo.portfolio}">Portfolio</a>` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 40px 50px; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a1a; }
  .header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #2563eb; }
  .header h1 { font-size: 22px; color: #1e3a8a; margin-bottom: 4px; }
  .header .headline { font-size: 13px; color: #4b5563; margin-bottom: 6px; }
  .header .contacts { font-size: 10px; color: #6b7280; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 13px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #dbeafe; padding-bottom: 3px; margin-bottom: 8px; }
  .summary { font-size: 11px; color: #374151; }
  .skills-container { display: flex; flex-wrap: wrap; gap: 4px; }
  .skill { background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 500; }
  .entry { margin-bottom: 10px; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
  .entry-header strong { color: #111827; }
  .date { font-size: 10px; color: #6b7280; white-space: nowrap; }
  .entry ul { margin: 4px 0 0 16px; }
  .entry li { font-size: 10.5px; color: #374151; margin-bottom: 2px; }
  .entry p { font-size: 10.5px; color: #4b5563; margin-top: 2px; }
  .tech { font-size: 9.5px; color: #6b7280; margin-top: 3px; }
  .cert, .lang { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 4px; display: inline-block; margin-bottom: 3px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${data.personalInfo.name}</h1>
    ${data.summary ? `<div class="headline">${data.summary.substring(0, 120)}</div>` : ""}
    <div class="contacts">${contacts}</div>
  </div>
  ${data.summary ? `<div class="section"><div class="section-title">Professional Summary</div><div class="summary">${data.summary}</div></div>` : ""}
  ${data.skills.length ? `<div class="section"><div class="section-title">Skills</div><div class="skills-container">${skillsHTML}</div></div>` : ""}
  ${data.experience.length ? `<div class="section"><div class="section-title">Experience</div>${expHTML}</div>` : ""}
  ${data.education.length ? `<div class="section"><div class="section-title">Education</div>${eduHTML}</div>` : ""}
  ${data.projects?.length ? `<div class="section"><div class="section-title">Projects</div>${projectsHTML}</div>` : ""}
  ${data.certifications?.length ? `<div class="section"><div class="section-title">Certifications</div><div>${certsHTML}</div></div>` : ""}
  ${data.languages?.length ? `<div class="section"><div class="section-title">Languages</div><div>${langsHTML}</div></div>` : ""}
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