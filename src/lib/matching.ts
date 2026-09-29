export type MatchBreakdown = {
  overallScore: number;
  skillScore: number;
  experienceScore: number;
  locationScore: number;
  roleScore: number;
  technologyScore: number;
  salaryScore: number;
  rating: "excellent" | "strong" | "good" | "fair" | "weak" | "poor";
  matchedSkills: string[];
  missingSkills: string[];
};

// Weight configuration
const WEIGHTS = {
  skill: 35,
  experience: 20,
  role: 15,
  technology: 15,
  location: 10,
  salary: 5,
};

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function calculateSkillOverlap(
  candidateSkills: string[],
  requiredSkills: string[],
  preferredSkills: string[]
): { score: number; matched: string[]; missing: string[] } {
  const normCandidate = new Set(candidateSkills.map(normalizeText));
  const allJobSkills = [
    ...new Set([...requiredSkills, ...preferredSkills].map(normalizeText)),
  ];

  if (allJobSkills.length === 0) {
    return { score: 100, matched: [], missing: [] };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of allJobSkills) {
    // Check for exact match or partial match
    const isMatch = [...normCandidate].some(
      (cs) =>
        cs.includes(skill) ||
        skill.includes(cs) ||
        areEquivalent(cs, skill)
    );

    if (isMatch) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  const score = Math.round((matched.length / allJobSkills.length) * 100);
  return { score, matched, missing };
}

function areEquivalent(a: string, b: string): boolean {
  const equivalences: [string, string][] = [
    ["js", "javascript"],
    ["ts", "typescript"],
    ["py", "python"],
    ["react.js", "react"],
    ["reactjs", "react"],
    ["next.js", "nextjs"],
    ["node.js", "nodejs"],
    ["vue.js", "vuejs"],
    ["vue.js", "vue"],
    ["angular.js", "angular"],
    ["postgresql", "postgres"],
    ["mongodb", "mongo"],
    ["aws lambda", "lambda"],
    ["rest api", "rest"],
    ["restful api", "rest"],
    ["graphql", "gql"],
    ["k8s", "kubernetes"],
    ["docker", "containers"],
  ];

  for (const [e1, e2] of equivalences) {
    if (
      (a.includes(e1) && b.includes(e2)) ||
      (a.includes(e2) && b.includes(e1))
    ) {
      return true;
    }
  }
  return false;
}

function calculateExperienceMatch(
  candidateYears: number,
  minRequired?: number | null,
  maxRequired?: number | null
): number {
  if (minRequired === undefined || minRequired === null) return 100;

  if (candidateYears >= minRequired) {
    if (maxRequired && candidateYears > maxRequired + 2) {
      // Overqualified by more than 2 years - slight penalty
      return 70;
    }
    return 100;
  }

  // Underqualified
  const gap = minRequired - candidateYears;
  if (gap <= 0.5) return 90;
  if (gap <= 1) return 70;
  if (gap <= 2) return 40;
  return 10;
}

function calculateLocationMatch(
  candidateLocations: string[],
  remotePreference: string | null | undefined,
  jobLocation?: string | null,
  jobRemoteType?: string | null
): number {
  if (!jobLocation && !jobRemoteType) return 50; // Unknown

  // Remote jobs
  if (jobRemoteType === "remote") {
    if (remotePreference === "remote" || remotePreference === "hybrid")
      return 100;
    return 70; // Remote is usually acceptable
  }

  // Hybrid
  if (jobRemoteType === "hybrid") {
    if (remotePreference === "remote") return 60;
    if (remotePreference === "hybrid" || remotePreference === "onsite")
      return 100;
    return 70;
  }

  // Onsite - check location match
  if (jobLocation && candidateLocations.length > 0) {
    const normJob = normalizeText(jobLocation);
    const isMatch = candidateLocations.some((cl) => {
      const normCand = normalizeText(cl);
      return (
        normJob.includes(normCand) ||
        normCand.includes(normJob) ||
        normJob.includes("india") && normCand.includes("india")
      );
    });
    return isMatch ? 100 : 20;
  }

  return 50; // Unknown
}

function calculateRoleMatch(
  candidateRoles: string[],
  jobTitle: string
): number {
  if (candidateRoles.length === 0) return 50;

  const normTitle = normalizeText(jobTitle);
  const matchScore = candidateRoles.reduce((best, role) => {
    const normRole = normalizeText(role);
    const words = normRole.split(/\s+/);
    const matchingWords = words.filter((w) => normTitle.includes(w));
    const score = (matchingWords.length / words.length) * 100;
    return Math.max(best, score);
  }, 0);

  return Math.max(matchScore, 20);
}

function calculateTechnologyMatch(
  candidateTech: string[],
  jobRequiredSkills: string[],
  jobPreferredSkills: string[]
): number {
  const allJobTech = [...jobRequiredSkills, ...jobPreferredSkills];
  if (allJobTech.length === 0 || candidateTech.length === 0) return 50;

  const normCandidate = new Set(candidateTech.map(normalizeText));
  const matched = allJobTech.filter((jt) => {
    const norm = normalizeText(jt);
    return [...normCandidate].some(
      (ct) => ct.includes(norm) || norm.includes(ct) || areEquivalent(ct, norm)
    );
  });

  return Math.round((matched.length / allJobTech.length) * 100);
}

function calculateSalaryMatch(
  candidateMin?: number | null,
  candidateMax?: number | null,
  jobMin?: number | null,
  jobMax?: number | null
): number {
  if (!candidateMin && !candidateMax) return 50; // No preference
  if (!jobMin && !jobMax) return 50; // Unknown

  const cMin = candidateMin || 0;
  const jMax = jobMax || jobMin || 0;
  const jMin = jobMin || 0;

  if (jMax > 0 && cMin > jMax) return 10; // Candidate wants more than offered
  if (jMin > 0 && (candidateMax || Infinity) < jMin) return 20;

  return 80; // Reasonable overlap
}

function getRating(
  score: number
): "excellent" | "strong" | "good" | "fair" | "weak" | "poor" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 55) return "good";
  if (score >= 40) return "fair";
  if (score >= 25) return "weak";
  return "poor";
}

export function calculateMatch(
  candidate: {
    skills: string[];
    technologies: string[];
    experienceYears: number;
    targetRoles: string[];
    preferredLocations: string[];
    remotePreference?: string | null;
    expectedSalaryMin?: number | null;
    expectedSalaryMax?: number | null;
  },
  job: {
    title: string;
    location?: string | null;
    remoteType?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    experienceMin?: number | null;
    experienceMax?: number | null;
    requiredSkills: string[];
    preferredSkills: string[];
  }
): MatchBreakdown {
  const skillResult = calculateSkillOverlap(
    candidate.skills,
    job.requiredSkills,
    job.preferredSkills
  );

  const expScore = calculateExperienceMatch(
    candidate.experienceYears,
    job.experienceMin,
    job.experienceMax
  );

  const locScore = calculateLocationMatch(
    candidate.preferredLocations,
    candidate.remotePreference,
    job.location,
    job.remoteType
  );

  const roleScore = calculateRoleMatch(candidate.targetRoles, job.title);

  const techScore = calculateTechnologyMatch(
    candidate.technologies,
    job.requiredSkills,
    job.preferredSkills
  );

  const salaryScore = calculateSalaryMatch(
    candidate.expectedSalaryMin,
    candidate.expectedSalaryMax,
    job.salaryMin,
    job.salaryMax
  );

  const overallScore = Math.round(
    (skillResult.score * WEIGHTS.skill +
      expScore * WEIGHTS.experience +
      roleScore * WEIGHTS.role +
      techScore * WEIGHTS.technology +
      locScore * WEIGHTS.location +
      salaryScore * WEIGHTS.salary) /
      100
  );

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    skillScore: skillResult.score,
    experienceScore: expScore,
    locationScore: locScore,
    roleScore,
    technologyScore: techScore,
    salaryScore,
    rating: getRating(overallScore),
    matchedSkills: skillResult.matched,
    missingSkills: skillResult.missing,
  };
}