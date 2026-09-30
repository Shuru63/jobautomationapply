import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
});

export const profileSchema = z.object({
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  linkedinUrl: z.string().optional().or(z.literal("")),
  githubUrl: z.string().optional().or(z.literal("")),
  portfolioUrl: z.string().optional().or(z.literal("")),
  websiteUrl: z.string().optional().or(z.literal("")),
  professionalSummary: z.string().max(2000).optional(),
  headline: z.string().max(255).optional(),
});

export const preferencesSchema = z.object({
  targetRoles: z.array(z.string()).optional(),
  preferredLocations: z.array(z.string()).optional(),
  remotePreference: z.enum(["remote", "onsite", "hybrid"]).optional(),
  employmentPreference: z
    .enum(["full_time", "part_time", "contract", "internship", "freelance"])
    .optional(),
  minExperienceYears: z.number().min(0).optional(),
  maxExperienceYears: z.number().min(0).optional(),
  expectedSalaryMin: z.number().min(0).optional(),
  expectedSalaryMax: z.number().min(0).optional(),
  salaryCurrency: z.string().optional(),
  preferredTechnologies: z.array(z.string()).optional(),
  openToRelocation: z.boolean().optional(),
  automationMode: z.enum(["manual", "assisted", "auto"]).optional(),
  autoApplyEnabled: z.boolean().optional(),
  maxDailyApplications: z.number().min(1).max(100).optional(),
  requireApprovalBeforeSubmit: z.boolean().optional(),
});

export const experienceSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  title: z.string().min(1, "Job title is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  isCurrent: z.boolean().optional(),
  highlights: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
});

export const educationSchema = z.object({
  institution: z.string().min(1, "Institution is required"),
  degree: z.string().min(1, "Degree is required"),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gpa: z.string().optional(),
  description: z.string().optional(),
});

export const skillSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  category: z.string().optional(),
  proficiencyLevel: z.number().min(1).max(5).optional(),
  yearsOfExperience: z.number().min(0).optional(),
  isPrimary: z.boolean().optional(),
});

export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  url: z.string().optional(),
  repositoryUrl: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const certificationSchema = z.object({
  name: z.string().min(1, "Certification name is required"),
  issuer: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  credentialUrl: z.string().optional(),
  credentialId: z.string().optional(),
});

export const languageSchema = z.object({
  name: z.string().min(1, "Language name is required"),
  proficiencyLevel: z.string().optional(),
});

export const jobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  companyId: z.string().optional(),
  location: z.string().optional(),
  remoteType: z.enum(["remote", "onsite", "hybrid"]).optional(),
  employmentType: z
    .enum(["full_time", "part_time", "contract", "internship", "freelance"])
    .optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().optional(),
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  experienceMin: z.number().optional(),
  experienceMax: z.number().optional(),
  sourceUrl: z.string().optional(),
});

export const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  domain: z.string().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().optional(),
  careersUrl: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type SkillInput = z.infer<typeof skillSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
export type LanguageInput = z.infer<typeof languageSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type CompanyInput = z.infer<typeof companySchema>;