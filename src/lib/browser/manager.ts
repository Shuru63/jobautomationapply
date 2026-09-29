import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { db } from "@/db";
import { documents } from "@/db/schema";

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    this.context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
  }

  async newPage(): Promise<Page> {
    if (!this.context) await this.launch();
    return this.context!.newPage();
  }

  async takeScreenshot(page: Page, candidateId: string, label: string): Promise<string> {
    const buffer = await page.screenshot({ fullPage: true });
    const fileName = `screenshot-${label}-${Date.now()}.png`;
    // Store locally in public/screenshots
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.join(process.cwd(), "public", "screenshots");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);

    // Store in documents table
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      candidateId,
      type: "other",
      name: fileName,
      fileUrl: `/screenshots/${fileName}`,
      fileSize: buffer.length,
      mimeType: "image/png",
    });

    return `/screenshots/${fileName}`;
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
    this.context = null;
    this.browser = null;
  }
}

// Singleton for worker processes
let instance: BrowserManager | null = null;

export function getBrowserManager(): BrowserManager {
  if (!instance) {
    instance = new BrowserManager();
  }
  return instance;
}