import type { Page } from "playwright";

export type DetectedField = {
  selector: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "file" | "radio" | "checkbox" | "url" | "number";
  name: string;
  id: string;
  placeholder: string;
  required: boolean;
  options?: string[];
};

export type CaptchaDetection = {
  detected: boolean;
  type: "recaptcha" | "hcaptcha" | "turnstile" | "unknown" | null;
  selector: string | null;
};

export type DetectedForm = {
  action: string;
  method: string;
  fields: DetectedField[];
  captcha: CaptchaDetection;
  hasFileUpload: boolean;
  submitSelector: string | null;
};

export async function detectApplicationForm(page: Page): Promise<DetectedForm> {
  // Wait for page to load
  await page.waitForLoadState("domcontentloaded").catch(() => {});

  // Detect CAPTCHA
  const captcha = await detectCaptcha(page);

  // Detect form fields
  const fields = await page.evaluate(() => {
    const fieldElements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    );
    const results: Array<{
      selector: string;
      label: string;
      type: string;
      name: string;
      id: string;
      placeholder: string;
      required: boolean;
      options?: string[];
    }> = [];

    fieldElements.forEach((el) => {
      const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const tagName = input.tagName.toLowerCase();
      const inputType = (input as HTMLInputElement).type?.toLowerCase() || "";

      // Skip hidden fields
      if (inputType === "hidden") return;
      const style = window.getComputedStyle(input);
      if (style.display === "none" || style.visibility === "hidden") return;

      // Find label
      let label = "";
      if (input.id) {
        const labelEl = document.querySelector(`label[for="${input.id}"]`);
        if (labelEl) label = labelEl.textContent?.trim() || "";
      }
      if (!label) {
        const parent = input.closest("label");
        if (parent) label = parent.textContent?.trim() || "";
      }
      if (!label) {
        label = (input as HTMLInputElement).placeholder || input.getAttribute("aria-label") || "";
      }

      // Determine field type
      let fieldType = inputType || "text";
      if (tagName === "textarea") fieldType = "textarea";
      if (tagName === "select") fieldType = "select";
      if (inputType === "file") fieldType = "file";
      if (inputType === "radio") fieldType = "radio";
      if (inputType === "checkbox") fieldType = "checkbox";
      if (inputType === "email") fieldType = "email";
      if (inputType === "tel") fieldType = "phone";
      if (inputType === "url") fieldType = "url";
      if (inputType === "number") fieldType = "number";

      // Get options for select
      let options: string[] | undefined;
      if (tagName === "select") {
        const select = input as HTMLSelectElement;
        options = Array.from(select.options).map((o) => o.text.trim()).filter(Boolean);
      }

      // Generate a unique selector
      let selector = "";
      if (input.id) {
        selector = `#${input.id}`;
      } else if (input.name) {
        selector = `[name="${input.name}"]`;
      } else {
        selector = `${tagName}[placeholder="${(input as HTMLInputElement).placeholder || ""}"]`;
      }

      results.push({
        selector,
        label: label.substring(0, 200),
        type: fieldType as string,
        name: (input as HTMLInputElement).name || "",
        id: input.id || "",
        placeholder: (input as HTMLInputElement).placeholder || "",
        required: input.required || input.getAttribute("aria-required") === "true",
        options,
      });
    });

    return results;
  });

  // Detect submit button
  const submitSelector = await page.evaluate(() => {
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Apply")',
      'button:has-text("Send")',
      'button:has-text("Next")',
      '[data-testid="submit-button"]',
      ".submit-btn",
      "#submit",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && (el as HTMLElement).offsetParent !== null) {
        return sel;
      }
    }
    return null;
  });

  const hasFileUpload = fields.some((f) => f.type === "file");

  return {
    action: await page.evaluate(() => (document.querySelector("form") as HTMLFormElement)?.action || ""),
    method: await page.evaluate(() => (document.querySelector("form") as HTMLFormElement)?.method || "post"),
    fields: fields as DetectedField[],
    captcha,
    hasFileUpload,
    submitSelector,
  };
}

async function detectCaptcha(page: Page): Promise<CaptchaDetection> {
  return page.evaluate(() => {
    const html = document.body.innerHTML.toLowerCase();

    // reCAPTCHA
    if (html.includes("g-recaptcha") || html.includes("recaptcha") || document.querySelector(".g-recaptcha") || document.querySelector("[data-sitekey]")) {
      return { detected: true, type: "recaptcha" as const, selector: ".g-recaptcha" };
    }
    // hCaptcha
    if (html.includes("h-captcha") || document.querySelector(".h-captcha")) {
      return { detected: true, type: "hcaptcha" as const, selector: ".h-captcha" };
    }
    // Cloudflare Turnstile
    if (html.includes("turnstile") || document.querySelector("[data-turnstile]")) {
      return { detected: true, type: "turnstile" as const, selector: "[data-turnstile]" };
    }
    return { detected: false, type: null, selector: null };
  });
}