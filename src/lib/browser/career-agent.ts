import type { Page } from "playwright";
import { getBrowserManager } from "./manager";

export type ScrapedJob = {
  title: string;
  description: string;
  location?: string;
  url: string;
  externalId?: string;
  department?: string;
  remoteType?: string;
};

export interface CareerPageScraper {
  scrapeJobs(url: string): Promise<ScrapedJob[]>;
}

// ─── Greenhouse Scraper ─────────────────────────────────────────────────────

export class GreenhouseScraper implements CareerPageScraper {
  async scrapeJobs(url: string): Promise<ScrapedJob[]> {
    // Extract board token from URL
    const boardMatch = url.match(/boards\.greenhouse\.io\/([^/]+)/);
    if (!boardMatch) return [];
    const boardToken = boardMatch[1];

    // Use Greenhouse Job Board API
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
    try {
      const res = await fetch(apiUrl, { next: { revalidate: 3600 } });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.jobs || []).map((job: Record<string, unknown>) => ({
        title: job.title as string,
        description: (job.content as string) || "",
        location: (job.location as Record<string, string>)?.name || "",
        url: job.absolute_url as string,
        externalId: String(job.id),
        department: (job.departments as Array<Record<string, string>>)?.[0]?.name,
      }));
    } catch {
      return [];
    }
  }
}

// ─── Lever Scraper ──────────────────────────────────────────────────────────

export class LeverScraper implements CareerPageScraper {
  async scrapeJobs(url: string): Promise<ScrapedJob[]> {
    const companyMatch = url.match(/lever\.co\/([^/]+)/);
    if (!companyMatch) return [];
    const company = companyMatch[1];

    const apiUrl = `https://api.lever.co/v0/postings/${company}?mode=json`;
    try {
      const res = await fetch(apiUrl, { next: { revalidate: 3600 } });
      if (!res.ok) return [];
      const data = await res.json();
      return (Array.isArray(data) ? data : []).map((job: Record<string, unknown>) => ({
        title: job.text as string,
        description: (job.descriptionPlain as string) || (job.description as string) || "",
        location: job.location as string || "",
        url: job.hostedUrl as string,
        externalId: job.id as string,
        department: (job.categories as Record<string, string>)?.department || "",
      }));
    } catch {
      return [];
    }
  }
}

// ─── Ashby Scraper ──────────────────────────────────────────────────────────

export class AshbyScraper implements CareerPageScraper {
  async scrapeJobs(url: string): Promise<ScrapedJob[]> {
    const orgMatch = url.match(/jobs\.ashbyhq\.com\/([^/]+)/);
    if (!orgMatch) return [];
    const org = orgMatch[1];

    // Ashby uses a GraphQL API but also has a public JSON endpoint
    const apiUrl = `https://jobs.ashbyhq.com/api/non-user-graphql?query=query{jobBoard:jobBoardWithFilters(organizationHostedJobsPageName:"${org}"){jobPostings{title,locationName,employmentType,department{id,name},externalUrl,jobUrl,id}}}`;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        next: { revalidate: 3600 },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const postings = data?.data?.jobBoard?.jobPostings || [];
      return postings.map((job: Record<string, unknown>) => ({
        title: job.title as string,
        description: "",
        location: job.locationName as string || "",
        url: (job.jobUrl as string) || `https://jobs.ashbyhq.com/${org}/${job.id}`,
        externalId: job.id as string,
        department: (job.department as Record<string, string>)?.name,
      }));
    } catch {
      return [];
    }
  }
}

// ─── Workday Scraper ────────────────────────────────────────────────────────

export class WorkdayScraper implements CareerPageScraper {
  async scrapeJobs(url: string): Promise<ScrapedJob[]> {
    const bm = getBrowserManager();
    let page: Page | null = null;
    const jobs: ScrapedJob[] = [];

    try {
      page = await bm.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      // Workday sites use dynamic loading - scroll to load more
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
      }

      // Detect Workday job listing structure
      const jobElements = await page.evaluate(() => {
        const selectors = [
          '[data-automation-id="jobTitle"]',
          '.jobTitle a',
          '[role="listitem"] a',
          'a[href*="job/"]',
        ];
        const results: Array<{ title: string; url: string; location: string }> = [];

        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            els.forEach((el) => {
              const a = el as HTMLAnchorElement;
              const locationEl = a.closest('[data-automation-id]')?.querySelector('[data-automation-id="location"]');
              results.push({
                title: a.textContent?.trim() || "",
                url: a.href || "",
                location: locationEl?.textContent?.trim() || "",
              });
            });
            break;
          }
        }
        return results;
      });

      for (const job of jobElements) {
        if (job.title) {
          jobs.push({
            title: job.title,
            description: "",
            location: job.location,
            url: job.url,
            externalId: job.url.split("/").pop(),
          });
        }
      }

      await bm.takeScreenshot(page, "workday-scraper", url.replace(/[^a-zA-Z0-9]/g, "_"));
    } catch (err) {
      console.error("Workday scrape error:", err);
    } finally {
      if (page) await page.close().catch(() => {});
    }

    return jobs;
  }
}

// ─── Generic Career Page Scraper ────────────────────────────────────────────

export class GenericCareerScraper implements CareerPageScraper {
  async scrapeJobs(url: string): Promise<ScrapedJob[]> {
    const bm = getBrowserManager();
    let page: Page | null = null;
    const jobs: ScrapedJob[] = [];

    try {
      page = await bm.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Scroll to load dynamic content
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
      }

      // Generic job detection heuristics
      const jobElements = await page.evaluate(() => {
        const results: Array<{ title: string; url: string; location: string; description: string }> = [];

        // Look for common job listing patterns
        const selectors = [
          // Common ATS patterns
          '.job-listing', '.job-posting', '.job-card', '.job-item',
          '.opening', '.position', '.vacancy', '.role-listing',
          // Greenhouse embeds
          '.opening', '#jobs li', '.job',
          // Generic patterns
          '[class*="job"] a', '[class*="opening"] a', '[class*="position"] a',
          'a[href*="job"]', 'a[href*="position"]', 'a[href*="opening"]',
        ];

        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length >= 2) {
            els.forEach((el) => {
              const a = el.tagName === "A" ? el as HTMLAnchorElement : el.querySelector("a") as HTMLAnchorElement;
              if (!a) return;
              const title = a.textContent?.trim() || "";
              const parent = a.closest("li, div, article, tr");
              const locationEl = parent?.querySelector('[class*="location"], [class*="city"], .location');
              const descEl = parent?.querySelector('[class*="description"], [class*="desc"], p');

              if (title.length > 3 && title.length < 200) {
                results.push({
                  title,
                  url: a.href,
                  location: locationEl?.textContent?.trim() || "",
                  description: descEl?.textContent?.trim()?.substring(0, 500) || "",
                });
              }
            });
            if (results.length > 0) break;
          }
        }
        return results;
      });

      for (const job of jobElements) {
        jobs.push({
          title: job.title,
          description: job.description,
          location: job.location,
          url: job.url,
          externalId: job.url.split("?")[0].split("/").pop(),
        });
      }
    } catch (err) {
      console.error("Generic career page scrape error:", err);
    } finally {
      if (page) await page.close().catch(() => {});
    }

    return jobs;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createScraper(type: string): CareerPageScraper {
  switch (type) {
    case "greenhouse":
      return new GreenhouseScraper();
    case "lever":
      return new LeverScraper();
    case "ashby":
      return new AshbyScraper();
    case "workday":
      return new WorkdayScraper();
    case "career_page":
    default:
      return new GenericCareerScraper();
  }
}