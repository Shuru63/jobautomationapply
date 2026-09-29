export type AutomationMode = "research" | "assisted" | "auto" | "manual";

export type SafetyCheckResult = {
  passed: boolean;
  mode: AutomationMode;
  disqualifiers: string[];
  warnings: string[];
  requiresApproval: boolean;
  canAutoSubmit: boolean;
};

export type CandidateRules = {
  automationMode: AutomationMode;
  maxDailyApplications: number;
  requireApprovalBeforeSubmit: boolean;
  openToRelocation: boolean;
  targetLocations: string[];
  excludedLocations: string[];
  targetRoles: string[];
  excludedRoles: string[];
  minSalary: number | null;
  maxSalary: number | null;
  allowedEmploymentTypes: string[];
  excludedEmploymentTypes: string[];
  minExperienceYears: number;
  maxExperienceYears: number;
  requireRemoteOk: boolean;
  excludedCompanies: string[];
  allowedSources: string[];
};

const DEFAULT_RULES: CandidateRules = {
  automationMode: "assisted",
  maxDailyApplications: 10,
  requireApprovalBeforeSubmit: true,
  openToRelocation: false,
  targetLocations: ["remote", "india"],
  excludedLocations: [],
  targetRoles: [],
  excludedRoles: ["intern", "internship"],
  minSalary: null,
  maxSalary: null,
  allowedEmploymentTypes: ["full_time"],
  excludedEmploymentTypes: ["internship"],
  minExperienceYears: 0,
  maxExperienceYears: 100,
  requireRemoteOk: false,
  excludedCompanies: [],
  allowedSources: [],
};

export function checkJobSafety(
  job: {
    title: string;
    location?: string | null;
    remoteType?: string | null;
    employmentType?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    experienceMin?: number | null;
    experienceMax?: number | null;
    source: string;
  },
  applicationCount: number,
  hasUnknownQuestions: boolean,
  hasCaptcha: boolean,
  rules: Partial<CandidateRules> = {}
): SafetyCheckResult {
  const r = { ...DEFAULT_RULES, ...rules };
  const disqualifiers: string[] = [];
  const warnings: string[] = [];

  // Daily limit check
  if (applicationCount >= r.maxDailyApplications) {
    disqualifiers.push(`Daily application limit reached (${r.maxDailyApplications})`);
  }

  // Employment type
  if (job.employmentType && r.excludedEmploymentTypes.includes(job.employmentType)) {
    disqualifiers.push(`Employment type excluded: ${job.employmentType}`);
  }

  // Experience range
  if (job.experienceMin !== null && job.experienceMin !== undefined) {
    if (job.experienceMin > r.maxExperienceYears) {
      disqualifiers.push(`Requires ${job.experienceMin}+ years, max configured is ${r.maxExperienceYears}`);
    }
  }

  // Role exclusions
  const titleLower = job.title.toLowerCase();
  for (const excluded of r.excludedRoles) {
    if (titleLower.includes(excluded.toLowerCase())) {
      disqualifiers.push(`Role excluded: contains "${excluded}"`);
    }
  }

  // Location check
  if (r.requireRemoteOk && job.remoteType !== "remote") {
    disqualifiers.push("Job is not remote");
  }

  if (job.location) {
    const locLower = job.location.toLowerCase();
    for (const excluded of r.excludedLocations) {
      if (locLower.includes(excluded.toLowerCase())) {
        disqualifiers.push(`Location excluded: ${job.location}`);
      }
    }
  }

  // Salary check
  if (r.minSalary && job.salaryMax && job.salaryMax < r.minSalary) {
    disqualifiers.push(`Salary too low: max ${job.salaryMax} < minimum ${r.minSalary}`);
  }

  // Source check
  if (r.allowedSources.length > 0 && !r.allowedSources.includes(job.source)) {
    disqualifiers.push(`Source not allowed: ${job.source}`);
  }

  // Warnings (don't disqualify but flag for review)
  if (hasCaptcha) {
    warnings.push("CAPTCHA detected on application page");
  }

  if (hasUnknownQuestions) {
    warnings.push("Unknown application questions detected");
  }

  if (job.salaryMin && r.maxSalary && job.salaryMin > r.maxSalary) {
    warnings.push(`Salary may be too high: min ${job.salaryMin} > preferred max ${r.maxSalary}`);
  }

  // Determine mode and permissions
  const passed = disqualifiers.length === 0;
  let canAutoSubmit = false;
  let requiresApproval = true;

  if (passed) {
    switch (r.automationMode) {
      case "research":
        canAutoSubmit = false;
        requiresApproval = true;
        break;
      case "assisted":
        canAutoSubmit = false;
        requiresApproval = true;
        break;
      case "auto":
        canAutoSubmit = !hasCaptcha && !hasUnknownQuestions && !r.requireApprovalBeforeSubmit;
        requiresApproval = !canAutoSubmit;
        break;
      case "manual":
        canAutoSubmit = false;
        requiresApproval = true;
        break;
    }
  }

  // Auto-stop conditions
  if (hasCaptcha) {
    canAutoSubmit = false;
    requiresApproval = true;
    warnings.push("CAPTCHA: Manual intervention required");
  }

  if (hasUnknownQuestions) {
    canAutoSubmit = false;
    requiresApproval = true;
    warnings.push("Unknown questions: Review required before submission");
  }

  return {
    passed,
    mode: r.automationMode,
    disqualifiers,
    warnings,
    requiresApproval,
    canAutoSubmit,
  };
}