import type { Page } from "playwright";
import type { DetectedField } from "./form-detector";

export type FieldMapping = {
  selector: string;
  value: string;
  type: string;
};

export function mapFieldsToProfile(
  fields: DetectedField[],
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
  }
): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const fullName = profile.fullName.toLowerCase();
  const email = profile.email.toLowerCase();

  for (const field of fields) {
    const label = field.label.toLowerCase();
    const name = field.name.toLowerCase();
    const placeholder = field.placeholder.toLowerCase();
    const id = field.id.toLowerCase();
    const combined = `${label} ${name} ${placeholder} ${id}`;

    let value = "";
    let skip = false;

    // Name fields
    if (
      combined.includes("first name") ||
      combined.includes("firstname") ||
      combined.includes("given name")
    ) {
      value = profile.fullName.split(" ")[0] || "";
    } else if (
      combined.includes("last name") ||
      combined.includes("lastname") ||
      combined.includes("surname") ||
      combined.includes("family name")
    ) {
      const parts = profile.fullName.split(" ");
      value = parts.length > 1 ? parts.slice(1).join(" ") : "";
    } else if (
      (combined.includes("full name") || combined.includes("fullname") || (combined.includes("name") && !combined.includes("company") && !combined.includes("file"))) &&
      field.type === "text"
    ) {
      value = profile.fullName;
    }
    // Email
    else if (field.type === "email" || combined.includes("e-mail") || combined.includes("email")) {
      value = profile.email;
    }
    // Phone
    else if (field.type === "phone" || combined.includes("phone") || combined.includes("mobile") || combined.includes("tel")) {
      value = profile.phone || "";
    }
    // Location
    else if (combined.includes("city") || combined.includes("location")) {
      value = profile.city || "";
    }
    // LinkedIn
    else if (combined.includes("linkedin") || combined.includes("linked in")) {
      value = profile.linkedin || "";
    }
    // GitHub
    else if (combined.includes("github") || combined.includes("git hub")) {
      value = profile.github || "";
    }
    // Portfolio
    else if (combined.includes("portfolio") || combined.includes("website") || combined.includes("personal url")) {
      value = profile.portfolio || profile.github || "";
    }
    // Experience years
    else if ((combined.includes("years") && combined.includes("experience")) || combined.includes("yoe")) {
      value = Math.round(profile.experienceYears).toString();
    }
    // Current title
    else if (combined.includes("current title") || combined.includes("current role") || combined.includes("job title")) {
      value = profile.currentTitle || "";
    }
    // Current company
    else if (combined.includes("current company") || combined.includes("employer") || combined.includes("company name")) {
      value = profile.currentCompany || "";
    }
    // Salary
    else if (combined.includes("salary") || combined.includes("compensation") || combined.includes("ctc")) {
      value = profile.expectedSalary?.toString() || "";
    }
    // Summary / cover letter / why
    else if (combined.includes("summary") || combined.includes("cover letter") || combined.includes("why") || combined.includes("motivation")) {
      value = profile.summary || "";
    }
    // File uploads - skip
    else if (field.type === "file") {
      skip = true;
    }
    // Radio/checkbox - skip for now
    else if (field.type === "radio" || field.type === "checkbox") {
      skip = true;
    }
    else {
      skip = true;
    }

    if (!skip && value) {
      mappings.push({
        selector: field.selector,
        value,
        type: field.type,
      });
    }
  }

  return mappings;
}

export async function fillForm(page: Page, mappings: FieldMapping[]): Promise<void> {
  for (const mapping of mappings) {
    try {
      const el = page.locator(mapping.selector).first();
      if (!(await el.isVisible().catch(() => false))) continue;

      if (mapping.type === "select") {
        await el.selectOption({ label: mapping.value }).catch(async () => {
          await el.selectOption(mapping.value).catch(() => {});
        });
      } else if (mapping.type === "textarea") {
        await el.fill(mapping.value).catch(() => {});
      } else {
        await el.fill(mapping.value).catch(() => {});
      }
    } catch {
      // Field not found or not interactable, skip
    }
  }
}

export async function uploadFile(page: Page, selector: string, filePath: string): Promise<void> {
  try {
    const fileInput = page.locator(selector).first();
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles(filePath).catch(() => {});
    }
  } catch {
    // File upload not possible
  }
}

export async function submitForm(page: Page, submitSelector: string | null): Promise<boolean> {
  if (!submitSelector) return false;
  try {
    const btn = page.locator(submitSelector).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      return true;
    }
  } catch {
    // Submit failed
  }
  return false;
}