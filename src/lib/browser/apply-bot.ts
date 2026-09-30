import { chromium, Page } from "playwright";
import fs from "fs/promises";
import path from "path";

export async function submitApplication(params: {
  applyUrl: string;
  resumeBuffer: Buffer;
  candidateInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  log: (level: "info" | "warn" | "error", msg: string) => Promise<void>;
}): Promise<{ success: boolean; message: string }> {
  const { applyUrl, resumeBuffer, candidateInfo, log } = params;

  // Save the buffer to a temporary file because Playwright file inputs require a file path
  const tempResumePath = path.join(process.cwd(), "tmp", `resume-${Date.now()}.pdf`);
  await fs.mkdir(path.dirname(tempResumePath), { recursive: true });
  await fs.writeFile(tempResumePath, resumeBuffer);

  let browser;
  try {
    await log("info", `🤖 Launching Auto-Apply Bot for: ${applyUrl}`);
    browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-http2', '--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Set a timeout
    page.setDefaultTimeout(15000);

    await page.goto(applyUrl, { waitUntil: "domcontentloaded" });

    // Very basic heuristic form filler for Lever and Greenhouse
    const url = page.url();
    if (url.includes("greenhouse.io")) {
      await log("info", `  → Detected Greenhouse form. Attempting to fill...`);
      await page.fill('input[name="job_application[first_name]"]', candidateInfo.firstName).catch(() => {});
      await page.fill('input[name="job_application[last_name]"]', candidateInfo.lastName).catch(() => {});
      await page.fill('input[name="job_application[email]"]', candidateInfo.email).catch(() => {});
      await page.fill('input[name="job_application[phone]"]', candidateInfo.phone).catch(() => {});
      
      // Try to attach resume
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(tempResumePath);
        await log("info", `  → Attached PDF Resume to Greenhouse form.`);
      }

      const screenshotDir = path.join(process.cwd(), "public", "screenshots");
      await fs.mkdir(screenshotDir, { recursive: true });
      
      // Pre-submit screenshot
      const preScreenshotName = `greenhouse-pre-${Date.now()}.png`;
      await page.screenshot({ path: path.join(screenshotDir, preScreenshotName), fullPage: true, timeout: 5000 }).catch((e) => log("warn", `Could not take pre-submit screenshot: ${e.message}`));
      await log("info", `📸 Pre-submit form captured: /screenshots/${preScreenshotName}`);

      // Actually click submit!
      await page.click('#submit_app');
      await log("info", `🚀 Clicked SUBMIT on Greenhouse form!`);
      
      // Wait for success page and take post-submit screenshot
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2000); 
      const postScreenshotName = `greenhouse-post-${Date.now()}.png`;
      await page.screenshot({ path: path.join(screenshotDir, postScreenshotName), fullPage: true }).catch((e) => log("warn", `Could not take post-submit screenshot: ${e.message}`));
      await log("info", `📸 Post-submit success page captured (if available): /screenshots/${postScreenshotName}`);
      
      return { success: true, message: `Application submitted! View proof at /screenshots/${postScreenshotName}` };
      
    } else if (url.includes("lever.co")) {
      await log("info", `  → Detected Lever form. Attempting to fill...`);
      // If it's the job description page, we need to click "Apply for this job" first
      const applyButton = await page.$('a.postings-btn');
      if (applyButton) {
        await applyButton.click();
        await page.waitForLoadState("networkidle");
      }

      await page.fill('input[name="name"]', `${candidateInfo.firstName} ${candidateInfo.lastName}`).catch(() => {});
      await page.fill('input[name="email"]', candidateInfo.email).catch(() => {});
      await page.fill('input[name="phone"]', candidateInfo.phone).catch(() => {});
      await page.fill('input[name="urls[LinkedIn]"]', candidateInfo.linkedin).catch(() => {});
      await page.fill('input[name="urls[GitHub]"]', candidateInfo.github).catch(() => {});
      
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(tempResumePath);
        await log("info", `  → Attached PDF Resume to Lever form.`);
      }

      const screenshotDir = path.join(process.cwd(), "public", "screenshots");
      await fs.mkdir(screenshotDir, { recursive: true });

      // Pre-submit screenshot
      const preScreenshotName = `lever-pre-${Date.now()}.png`;
      await page.screenshot({ path: path.join(screenshotDir, preScreenshotName), fullPage: true, timeout: 5000 }).catch((e) => log("warn", `Could not take pre-submit screenshot: ${e.message}`));
      await log("info", `📸 Pre-submit form captured: /screenshots/${preScreenshotName}`);

      // Actually click submit!
      await page.click('button[type="submit"]');
      await log("info", `🚀 Clicked SUBMIT on Lever form!`);
      
      // Wait for success page and take post-submit screenshot
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2000);
      const postScreenshotName = `lever-post-${Date.now()}.png`;
      await page.screenshot({ path: path.join(screenshotDir, postScreenshotName), fullPage: true }).catch((e) => log("warn", `Could not take post-submit screenshot: ${e.message}`));
      await log("info", `📸 Post-submit success page captured (if available): /screenshots/${postScreenshotName}`);

      return { success: true, message: `Application submitted! View proof at /screenshots/${postScreenshotName}` };
    } else {
      await log("warn", `  ⚠️ Unsupported form type for fully autonomous submission.`);
      return { success: false, message: "Unsupported form structure for auto-submit." };
    }

  } catch (err) {
    await log("error", `❌ Auto-Apply Bot failed: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, message: "Auto-apply bot crashed." };
  } finally {
    if (browser) await browser.close();
    // Clean up temp file
    await fs.unlink(tempResumePath).catch(() => {});
  }
}
