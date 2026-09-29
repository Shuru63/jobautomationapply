import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["candidate", "admin"]);
export const jobRemoteTypeEnum = pgEnum("job_remote_type", [
  "remote",
  "onsite",
  "hybrid",
]);
export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "freelance",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "draft",
  "pending_review",
  "approved",
  "submitted",
  "viewed",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "accepted",
]);
export const matchRatingEnum = pgEnum("match_rating", [
  "excellent",
  "strong",
  "good",
  "fair",
  "weak",
  "poor",
]);
export const resumeTemplateEnum = pgEnum("resume_template", [
  "master",
  "job_specific",
  "role_specific",
]);
export const automationStatusEnum = pgEnum("automation_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const automationModeEnum = pgEnum("automation_mode", [
  "manual",
  "assisted",
  "auto",
]);
export const jobSourceTypeEnum = pgEnum("job_source_type", [
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "api",
  "career_page",
  "manual",
]);
export const documentTypeEnum = pgEnum("document_type", [
  "resume",
  "cover_letter",
  "certificate",
  "portfolio",
  "other",
]);
export const aiGenerationTypeEnum = pgEnum("ai_generation_type", [
  "job_analysis",
  "resume_content",
  "cover_letter",
  "question_answer",
  "interview_prep",
  "skill_extraction",
]);

// ─── USERS & AUTH ────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: roleEnum("role").notNull().default("candidate"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
  ]
);

// ─── CANDIDATE PROFILE ───────────────────────────────────────────────────────

export const candidateProfiles = pgTable(
  "candidate_profiles",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Personal info
    phone: varchar("phone", { length: 20 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    country: varchar("country", { length: 100 }).default("India"),
    linkedinUrl: text("linkedin_url"),
    githubUrl: text("github_url"),
    portfolioUrl: text("portfolio_url"),
    websiteUrl: text("website_url"),

    // Professional summary
    professionalSummary: text("professional_summary"),
    headline: varchar("headline", { length: 255 }),

    // Job preferences
    targetRoles: jsonb("target_roles").$type<string[]>().default([]),
    preferredLocations: jsonb("preferred_locations")
      .$type<string[]>()
      .default([]),
    remotePreference: jobRemoteTypeEnum("remote_preference"),
    employmentPreference: employmentTypeEnum("employment_preference"),
    minExperienceYears: integer("min_experience_years").default(0),
    maxExperienceYears: integer("max_experience_years"),
    expectedSalaryMin: integer("expected_salary_min"),
    expectedSalaryMax: integer("expected_salary_max"),
    salaryCurrency: varchar("salary_currency", { length: 10 }).default("INR"),
    preferredTechnologies: jsonb("preferred_technologies")
      .$type<string[]>()
      .default([]),
    openToRelocation: boolean("open_to_relocation").default(false),

    // Application preferences
    automationMode: automationModeEnum("automation_mode")
      .notNull()
      .default("assisted"),
    autoApplyEnabled: boolean("auto_apply_enabled").default(false),
    maxDailyApplications: integer("max_daily_applications").default(10),
    requireApprovalBeforeSubmit: boolean("require_approval_before_submit")
      .notNull()
      .default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("candidate_profiles_user_id_idx").on(table.userId)]
);

// ─── EXPERIENCE ──────────────────────────────────────────────────────────────

export const experiences = pgTable("experiences", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  company: varchar("company", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isCurrent: boolean("is_current").default(false),
  highlights: jsonb("highlights").$type<string[]>().default([]),
  technologies: jsonb("technologies").$type<string[]>().default([]),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── EDUCATION ───────────────────────────────────────────────────────────────

export const education = pgTable("education", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  institution: varchar("institution", { length: 255 }).notNull(),
  degree: varchar("degree", { length: 255 }).notNull(),
  fieldOfStudy: varchar("field_of_study", { length: 255 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  gpa: varchar("gpa", { length: 20 }),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── SKILLS ──────────────────────────────────────────────────────────────────

export const skills = pgTable("skills", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }),
  proficiencyLevel: integer("proficiency_level").default(3), // 1-5
  yearsOfExperience: integer("years_of_experience"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── PROJECTS ────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  url: text("url"),
  repositoryUrl: text("repository_url"),
  technologies: jsonb("technologies").$type<string[]>().default([]),
  highlights: jsonb("highlights").$type<string[]>().default([]),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── CERTIFICATIONS ──────────────────────────────────────────────────────────

export const certifications = pgTable("certifications", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  issuer: varchar("issuer", { length: 255 }),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  credentialUrl: text("credential_url"),
  credentialId: varchar("credential_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── LANGUAGES ───────────────────────────────────────────────────────────────

export const languages = pgTable("languages", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  proficiencyLevel: varchar("proficiency_level", { length: 50 }), // native, fluent, intermediate, basic
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── COMPANIES ───────────────────────────────────────────────────────────────

export const companies = pgTable(
  "companies",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }),
    description: text("description"),
    industry: varchar("industry", { length: 100 }),
    size: varchar("size", { length: 50 }),
    location: varchar("location", { length: 255 }),
    websiteUrl: text("website_url"),
    careersUrl: text("careers_url"),
    logoUrl: text("logo_url"),
    linkedinUrl: text("linkedin_url"),
    glassdoorUrl: text("glassdoor_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("companies_name_idx").on(table.name)]
);

// ─── JOBS ────────────────────────────────────────────────────────────────────

export const jobs = pgTable(
  "jobs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: varchar("company_id", { length: 36 }).references(
      () => companies.id,
      { onDelete: "set null" }
    ),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    location: varchar("location", { length: 255 }),
    remoteType: jobRemoteTypeEnum("remote_type"),
    employmentType: employmentTypeEnum("employment_type"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: varchar("salary_currency", { length: 10 }).default("INR"),
    requiredSkills: jsonb("required_skills").$type<string[]>().default([]),
    preferredSkills: jsonb("preferred_skills").$type<string[]>().default([]),
    experienceMin: integer("experience_min"),
    experienceMax: integer("experience_max"),
    source: jobSourceTypeEnum("source").notNull().default("manual"),
    sourceUrl: text("source_url"),
    externalId: varchar("external_id", { length: 255 }),
    postedAt: timestamp("posted_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").notNull().default(true),
    isSaved: boolean("is_saved").default(false),
    isIgnored: boolean("is_ignored").default(false),
    ignoreReason: text("ignore_reason"),
    notes: text("notes"),
    rawHtml: text("raw_html"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("jobs_company_id_idx").on(table.companyId),
    index("jobs_source_idx").on(table.source),
    index("jobs_is_active_idx").on(table.isActive),
    uniqueIndex("jobs_source_external_idx").on(table.source, table.externalId),
  ]
);

// ─── JOB MATCHES ─────────────────────────────────────────────────────────────

export const jobMatches = pgTable(
  "job_matches",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateId: varchar("candidate_id", { length: 36 })
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    jobId: varchar("job_id", { length: 36 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    // Scoring breakdown
    overallScore: integer("overall_score").notNull().default(0), // 0-100
    skillScore: integer("skill_score").default(0),
    experienceScore: integer("experience_score").default(0),
    locationScore: integer("location_score").default(0),
    roleScore: integer("role_score").default(0),
    technologyScore: integer("technology_score").default(0),
    salaryScore: integer("salary_score").default(0),
    rating: matchRatingEnum("rating").notNull().default("fair"),

    // AI analysis
    matchedSkills: jsonb("matched_skills").$type<string[]>().default([]),
    missingSkills: jsonb("missing_skills").$type<string[]>().default([]),
    atsKeywords: jsonb("ats_keywords").$type<string[]>().default([]),
    reasoning: text("reasoning"),
    strengthsAndWeaknesses: jsonb("strengths_and_weaknesses").$type<{
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    }>(),

    recommendApplication: boolean("recommend_application").default(false),
    analyzedAt: timestamp("analyzed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_matches_candidate_job_idx").on(
      table.candidateId,
      table.jobId
    ),
    index("job_matches_overall_score_idx").on(table.overallScore),
    index("job_matches_rating_idx").on(table.rating),
  ]
);

// ─── RESUMES ─────────────────────────────────────────────────────────────────

export const resumes = pgTable("resumes", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, {
    onDelete: "set null",
  }),
  template: resumeTemplateEnum("template").notNull().default("master"),
  title: varchar("title", { length: 255 }).notNull(),

  // Structured content
  content: jsonb("content").$type<{
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
  }>(),

  fileUrl: text("file_url"),
  fileName: varchar("file_name", { length: 255 }),
  fileType: varchar("file_type", { length: 20 }), // pdf, docx
  isActive: boolean("is_active").default(false),
  version: integer("version").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── COVER LETTERS ───────────────────────────────────────────────────────────

export const coverLetters = pgTable("cover_letters", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, {
    onDelete: "set null",
  }),
  resumeId: varchar("resume_id", { length: 36 }).references(() => resumes.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 255 }),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── APPLICATIONS ────────────────────────────────────────────────────────────

export const applications = pgTable(
  "applications",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateId: varchar("candidate_id", { length: 36 })
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    jobId: varchar("job_id", { length: 36 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    resumeId: varchar("resume_id", { length: 36 }).references(
      () => resumes.id,
      { onDelete: "set null" }
    ),
    coverLetterId: varchar("cover_letter_id", { length: 36 }).references(
      () => coverLetters.id,
      { onDelete: "set null" }
    ),
    status: applicationStatusEnum("status").notNull().default("draft"),
    appliedAt: timestamp("applied_at"),
    sourceUrl: text("source_url"),

    // Form data snapshot
    formFields: jsonb("form_fields").$type<
      Record<string, string | number | boolean>
    >().default({}),

    // Automation metadata
    browserSessionId: varchar("browser_session_id", { length: 255 }),
    screenshotUrl: text("screenshot_url"),
    failureReason: text("failure_reason"),
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("applications_candidate_id_idx").on(table.candidateId),
    index("applications_job_id_idx").on(table.jobId),
    index("applications_status_idx").on(table.status),
    uniqueIndex("applications_candidate_job_idx").on(
      table.candidateId,
      table.jobId
    ),
  ]
);

// ─── APPLICATION QUESTIONS ───────────────────────────────────────────────────

export const applicationQuestions = pgTable("application_questions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  applicationId: varchar("application_id", { length: 36 })
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: varchar("question_type", { length: 50 }).default("text"), // text, textarea, select, yes_no
  options: jsonb("options").$type<string[]>().default([]),
  isRequired: boolean("is_required").default(false),
  maxLength: integer("max_length"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── APPLICATION ANSWERS ─────────────────────────────────────────────────────

export const applicationAnswers = pgTable("application_answers", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  questionId: varchar("question_id", { length: 36 })
    .notNull()
    .references(() => applicationQuestions.id, { onDelete: "cascade" }),
  applicationId: varchar("application_id", { length: 36 })
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  answerText: text("answer_text").notNull(),
  aiGenerated: boolean("ai_generated").default(false),
  reviewed: boolean("reviewed").default(false),
  approved: boolean("approved").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── APPLICATION EVENTS (audit trail) ────────────────────────────────────────

export const applicationEvents = pgTable("application_events", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  applicationId: varchar("application_id", { length: 36 })
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(), // status_change, form_filled, error, etc.
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── INTERVIEWS ──────────────────────────────────────────────────────────────

export const interviews = pgTable("interviews", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  applicationId: varchar("application_id", { length: 36 })
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").default(1),
  roundType: varchar("round_type", { length: 100 }), // phone, technical, hr, system_design, behavioral
  scheduledAt: timestamp("scheduled_at"),
  durationMinutes: integer("duration_minutes"),
  location: varchar("location", { length: 255 }),
  meetingUrl: text("meeting_url"),
  interviewerName: varchar("interviewer_name", { length: 255 }),
  interviewerEmail: varchar("interviewer_email", { length: 255 }),
  notes: text("notes"),
  feedback: text("feedback"),
  rating: integer("rating"), // 1-5
  status: varchar("status", { length: 50 }).default("scheduled"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── INTERVIEW PREPARATION ───────────────────────────────────────────────────

export const interviewPreparations = pgTable("interview_preparations", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  interviewId: varchar("interview_id", { length: 36 })
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" }),
  companyResearch: text("company_research"),
  roleAnalysis: text("role_analysis"),
  technicalTopics: jsonb("technical_topics").$type<string[]>().default([]),
  behavioralQuestions: jsonb("behavioral_questions")
    .$type<string[]>()
    .default([]),
  technicalQuestions: jsonb("technical_questions")
    .$type<string[]>()
    .default([]),
  projectQuestions: jsonb("project_questions").$type<string[]>().default([]),
  questionsToAsk: jsonb("questions_to_ask").$type<string[]>().default([]),
  resumeTopics: jsonb("resume_topics").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── JOB SOURCES ─────────────────────────────────────────────────────────────

export const jobSources = pgTable("job_sources", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  type: jobSourceTypeEnum("type").notNull(),
  url: text("url").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  isActive: boolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  lastRunJobCount: integer("last_run_job_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── AUTOMATION RUNS ─────────────────────────────────────────────────────────

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateId: varchar("candidate_id", { length: 36 })
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    jobSourceId: varchar("job_source_id", { length: 36 }).references(
      () => jobSources.id,
      { onDelete: "set null" }
    ),
    type: varchar("type", { length: 50 }).notNull(), // job_search, matching, resume_gen, application
    status: automationStatusEnum("status").notNull().default("pending"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    result: jsonb("result").$type<{
      jobsFound?: number;
      duplicatesFiltered?: number;
      validJobs?: number;
      matchedJobs?: number;
      resumesGenerated?: number;
      applicationsPrepared?: number;
      applicationsSubmitted?: number;
      errors?: string[];
    }>().default({}),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("automation_runs_candidate_id_idx").on(table.candidateId),
    index("automation_runs_status_idx").on(table.status),
    index("automation_runs_type_idx").on(table.type),
  ]
);

// ─── AUTOMATION EVENTS ───────────────────────────────────────────────────────

export const automationEvents = pgTable("automation_events", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  runId: varchar("run_id", { length: 36 })
    .notNull()
    .references(() => automationRuns.id, { onDelete: "cascade" }),
  level: varchar("level", { length: 20 }).notNull().default("info"), // info, warn, error
  message: text("message").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

export const documents = pgTable("documents", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── AI GENERATIONS (audit log) ──────────────────────────────────────────────

export const aiGenerations = pgTable("ai_generations", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: varchar("candidate_id", { length: 36 })
    .notNull()
    .references(() => candidateProfiles.id, { onDelete: "cascade" }),
  type: aiGenerationTypeEnum("type").notNull(),
  jobId: varchar("job_id", { length: 36 }),
  input: jsonb("input").$type<Record<string, unknown>>().default({}),
  output: jsonb("output").$type<Record<string, unknown>>().default({}),
  model: varchar("model", { length: 100 }),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── RELATIONS ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(candidateProfiles, {
    fields: [users.id],
    references: [candidateProfiles.userId],
  }),
}));

export const candidateProfilesRelations = relations(
  candidateProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [candidateProfiles.userId],
      references: [users.id],
    }),
    experiences: many(experiences),
    education: many(education),
    skills: many(skills),
    projects: many(projects),
    certifications: many(certifications),
    languages: many(languages),
    resumes: many(resumes),
    coverLetters: many(coverLetters),
    applications: many(applications),
    jobMatches: many(jobMatches),
  })
);

export const experiencesRelations = relations(experiences, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [experiences.candidateId],
    references: [candidateProfiles.id],
  }),
}));

export const educationRelations = relations(education, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [education.candidateId],
    references: [candidateProfiles.id],
  }),
}));

export const skillsRelations = relations(skills, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [skills.candidateId],
    references: [candidateProfiles.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [projects.candidateId],
    references: [candidateProfiles.id],
  }),
}));

export const certificationsRelations = relations(
  certifications,
  ({ one }) => ({
    candidate: one(candidateProfiles, {
      fields: [certifications.candidateId],
      references: [candidateProfiles.id],
    }),
  })
);

export const languagesRelations = relations(languages, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [languages.candidateId],
    references: [candidateProfiles.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  matches: many(jobMatches),
  applications: many(applications),
  resumes: many(resumes),
  coverLetters: many(coverLetters),
}));

export const jobMatchesRelations = relations(jobMatches, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [jobMatches.candidateId],
    references: [candidateProfiles.id],
  }),
  job: one(jobs, {
    fields: [jobMatches.jobId],
    references: [jobs.id],
  }),
}));

export const resumesRelations = relations(resumes, ({ one, many }) => ({
  candidate: one(candidateProfiles, {
    fields: [resumes.candidateId],
    references: [candidateProfiles.id],
  }),
  job: one(jobs, {
    fields: [resumes.jobId],
    references: [jobs.id],
  }),
  coverLetters: many(coverLetters),
}));

export const coverLettersRelations = relations(coverLetters, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [coverLetters.candidateId],
    references: [candidateProfiles.id],
  }),
  job: one(jobs, {
    fields: [coverLetters.jobId],
    references: [jobs.id],
  }),
  resume: one(resumes, {
    fields: [coverLetters.resumeId],
    references: [resumes.id],
  }),
}));

export const applicationsRelations = relations(
  applications,
  ({ one, many }) => ({
    candidate: one(candidateProfiles, {
      fields: [applications.candidateId],
      references: [candidateProfiles.id],
    }),
    job: one(jobs, {
      fields: [applications.jobId],
      references: [jobs.id],
    }),
    resume: one(resumes, {
      fields: [applications.resumeId],
      references: [resumes.id],
    }),
    coverLetter: one(coverLetters, {
      fields: [applications.coverLetterId],
      references: [coverLetters.id],
    }),
    questions: many(applicationQuestions),
    events: many(applicationEvents),
    interviews: many(interviews),
  })
);

export const applicationQuestionsRelations = relations(
  applicationQuestions,
  ({ one, many }) => ({
    application: one(applications, {
      fields: [applicationQuestions.applicationId],
      references: [applications.id],
    }),
    answers: many(applicationAnswers),
  })
);

export const applicationAnswersRelations = relations(
  applicationAnswers,
  ({ one }) => ({
    question: one(applicationQuestions, {
      fields: [applicationAnswers.questionId],
      references: [applicationQuestions.id],
    }),
    application: one(applications, {
      fields: [applicationAnswers.applicationId],
      references: [applications.id],
    }),
  })
);

export const applicationEventsRelations = relations(
  applicationEvents,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationEvents.applicationId],
      references: [applications.id],
    }),
  })
);

export const interviewsRelations = relations(interviews, ({ one }) => ({
  application: one(applications, {
    fields: [interviews.applicationId],
    references: [applications.id],
  }),
  preparation: one(interviewPreparations),
}));

export const interviewPreparationsRelations = relations(
  interviewPreparations,
  ({ one }) => ({
    interview: one(interviews, {
      fields: [interviewPreparations.interviewId],
      references: [interviews.id],
    }),
  })
);

export const automationRunsRelations = relations(
  automationRuns,
  ({ one, many }) => ({
    candidate: one(candidateProfiles, {
      fields: [automationRuns.candidateId],
      references: [candidateProfiles.id],
    }),
    jobSource: one(jobSources, {
      fields: [automationRuns.jobSourceId],
      references: [jobSources.id],
    }),
    events: many(automationEvents),
  })
);

export const automationEventsRelations = relations(
  automationEvents,
  ({ one }) => ({
    run: one(automationRuns, {
      fields: [automationEvents.runId],
      references: [automationRuns.id],
    }),
  })
);

export const documentsRelations = relations(documents, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [documents.candidateId],
    references: [candidateProfiles.id],
  }),
}));

export const aiGenerationsRelations = relations(aiGenerations, ({ one }) => ({
  candidate: one(candidateProfiles, {
    fields: [aiGenerations.candidateId],
    references: [candidateProfiles.id],
  }),
}));