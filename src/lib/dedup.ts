import crypto from "crypto";

export function generateContentHash(job: {
  title: string;
  company: string;
  location?: string;
  description: string;
}): string {
  // Normalize the content
  const normalized = [
    job.title.toLowerCase().trim().replace(/\s+/g, " "),
    job.company.toLowerCase().trim().replace(/\s+/g, " "),
    (job.location || "").toLowerCase().trim().replace(/\s+/g, " "),
    // Hash first 500 chars of description for fuzzy matching
    job.description.toLowerCase().trim().replace(/\s+/g, " ").substring(0, 500),
  ].join("|");

  return crypto.createHash("md5").update(normalized).digest("hex");
}

export function areJobsSimilar(
  a: { title: string; company: string; location?: string; description: string },
  b: { title: string; company: string; location?: string; description: string }
): boolean {
  // Same company
  const companyA = a.company.toLowerCase().trim();
  const companyB = b.company.toLowerCase().trim();
  if (companyA !== companyB) return false;

  // Similar title (fuzzy)
  const titleA = a.title.toLowerCase().trim();
  const titleB = b.title.toLowerCase().trim();
  const titleSimilarity = stringSimilarity(titleA, titleB);
  if (titleSimilarity < 0.7) return false;

  // Similar location (if both have)
  if (a.location && b.location) {
    const locSimilarity = stringSimilarity(
      a.location.toLowerCase(),
      b.location.toLowerCase()
    );
    if (locSimilarity < 0.5) return false;
  }

  // Similar description (first 200 chars)
  const descA = a.description.toLowerCase().substring(0, 200);
  const descB = b.description.toLowerCase().substring(0, 200);
  const descSimilarity = stringSimilarity(descA, descB);
  if (descSimilarity < 0.6) return false;

  return true;
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Simple Jaccard similarity on word tokens
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}