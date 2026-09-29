import fs from "fs";
import path from "path";

const SESSION_DIR = path.join(process.cwd(), ".browser-sessions");

function ensureDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

export type BrowserSession = {
  id: string;
  name: string;
  site: string;
  cookies: string; // JSON stringified
  localStorage: string; // JSON stringified
  userAgent: string;
  createdAt: string;
  lastUsedAt: string;
  isActive: boolean;
};

export function saveSession(session: BrowserSession): void {
  ensureDir();
  const filePath = path.join(SESSION_DIR, `${session.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
}

export function loadSession(sessionId: string): BrowserSession | null {
  ensureDir();
  const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function listSessions(site?: string): BrowserSession[] {
  ensureDir();
  const files = fs.readdirSync(SESSION_DIR).filter((f) => f.endsWith(".json"));
  const sessions: BrowserSession[] = [];
  for (const file of files) {
    try {
      const session: BrowserSession = JSON.parse(
        fs.readFileSync(path.join(SESSION_DIR, file), "utf-8")
      );
      if (!site || session.site === site) {
        sessions.push(session);
      }
    } catch {
      // Skip corrupted files
    }
  }
  return sessions;
}

export function deleteSession(sessionId: string): boolean {
  const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export async function captureSession(
  page: import("playwright").Page,
  name: string,
  site: string
): Promise<BrowserSession> {
  const context = page.context();
  const cookies = await context.cookies();
  const localStorage = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) items[key] = window.localStorage.getItem(key) || "";
    }
    return JSON.stringify(items);
  });

  const session: BrowserSession = {
    id: crypto.randomUUID(),
    name,
    site,
    cookies: JSON.stringify(cookies),
    localStorage,
    userAgent: await page.evaluate(() => navigator.userAgent),
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    isActive: true,
  };

  saveSession(session);
  return session;
}

export async function restoreSession(
  context: import("playwright").BrowserContext,
  sessionId: string
): Promise<boolean> {
  const session = loadSession(sessionId);
  if (!session) return false;

  try {
    // Restore cookies
    const cookies = JSON.parse(session.cookies);
    await context.addCookies(cookies);

    // Update last used
    session.lastUsedAt = new Date().toISOString();
    saveSession(session);

    return true;
  } catch {
    return false;
  }
}