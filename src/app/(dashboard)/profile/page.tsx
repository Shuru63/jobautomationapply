"use client";

import { useState, useEffect, useCallback } from "react";

type Profile = {
  id: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  websiteUrl?: string | null;
  professionalSummary?: string | null;
  headline?: string | null;
  targetRoles?: string[];
  preferredLocations?: string[];
  remotePreference?: string | null;
  employmentPreference?: string | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  preferredTechnologies?: string[];
  openToRelocation?: boolean | null;
  automationMode?: string;
  maxDailyApplications?: number | null;
  requireApprovalBeforeSubmit?: boolean;
};

type Experience = {
  id: string;
  company: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean | null;
  highlights?: string[];
  technologies?: string[];
};

type Education = {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  gpa?: string | null;
};

type Skill = {
  id: string;
  name: string;
  category?: string | null;
  proficiencyLevel?: number | null;
  yearsOfExperience?: number | null;
  isPrimary?: boolean | null;
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  url?: string | null;
  technologies?: string[];
  highlights?: string[];
};

type Certification = {
  id: string;
  name: string;
  issuer?: string | null;
  issueDate?: string | null;
};

type Language = {
  id: string;
  name: string;
  proficiencyLevel?: string | null;
};

type FullProfile = Profile & {
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
  certifications: Certification[];
  languages: Language[];
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [message, setMessage] = useState({ type: "", text: "" });

  // Form states
  const [personalForm, setPersonalForm] = useState({
    phone: "",
    city: "",
    state: "",
    country: "India",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    websiteUrl: "",
    professionalSummary: "",
    headline: "",
  });

  const [preferencesForm, setPreferencesForm] = useState({
    targetRoles: [] as string[],
    preferredLocations: [] as string[],
    remotePreference: "",
    employmentPreference: "full_time",
    minExperienceYears: 0,
    maxExperienceYears: 0,
    expectedSalaryMin: 0,
    expectedSalaryMax: 0,
    preferredTechnologies: [] as string[],
    openToRelocation: false,
    automationMode: "assisted",
    maxDailyApplications: 10,
    requireApprovalBeforeSubmit: true,
  });

  // Experience form
  const [expForm, setExpForm] = useState({
    company: "",
    title: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    highlights: [] as string[],
    technologies: [] as string[],
  });
  const [expHighlightInput, setExpHighlightInput] = useState("");
  const [expTechInput, setExpTechInput] = useState("");

  // Education form
  const [eduForm, setEduForm] = useState({
    institution: "",
    degree: "",
    fieldOfStudy: "",
    startDate: "",
    endDate: "",
    gpa: "",
  });

  // Skill form
  const [skillForm, setSkillForm] = useState({
    name: "",
    category: "",
    proficiencyLevel: 3,
    yearsOfExperience: 0,
  });

  // Project form
  const [projForm, setProjForm] = useState({
    name: "",
    description: "",
    url: "",
    technologies: [] as string[],
    highlights: [] as string[],
  });
  const [projTechInput, setProjTechInput] = useState("");
  const [projHighlightInput, setProjHighlightInput] = useState("");

  // Cert form
  const [certForm, setCertForm] = useState({
    name: "",
    issuer: "",
    issueDate: "",
  });

  // Language form
  const [langForm, setLangForm] = useState({
    name: "",
    proficiencyLevel: "intermediate",
  });

  const [showExpForm, setShowExpForm] = useState(false);
  const [showEduForm, setShowEduForm] = useState(false);
  const [showProjForm, setShowProjForm] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [showLangForm, setShowLangForm] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvResult, setCvResult] = useState<{
    skillsCount: number;
    experienceCount: number;
    educationCount: number;
    projectsCount: number;
  } | null>(null);

  const uploadCV = async (file: File) => {
    setCvUploading(true);
    setCvResult(null);
    try {
      const formData = new FormData();
      formData.append("cv", file);
      const res = await fetch("/api/cv-upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setCvResult(data.parsed);
        fetchProfile();
      } else {
        const data = await res.json();
        alert(data.error || "CV upload failed");
      }
    } catch {
      alert("CV upload failed");
    } finally {
      setCvUploading(false);
    }
  };

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        const p = data.profile;
        setProfile(p);
        setPersonalForm({
          phone: p.phone || "",
          city: p.city || "",
          state: p.state || "",
          country: p.country || "India",
          linkedinUrl: p.linkedinUrl || "",
          githubUrl: p.githubUrl || "",
          portfolioUrl: p.portfolioUrl || "",
          websiteUrl: p.websiteUrl || "",
          professionalSummary: p.professionalSummary || "",
          headline: p.headline || "",
        });
        setPreferencesForm({
          targetRoles: (p.targetRoles as string[]) || [],
          preferredLocations: (p.preferredLocations as string[]) || [],
          remotePreference: p.remotePreference || "",
          employmentPreference: p.employmentPreference || "full_time",
          minExperienceYears: p.minExperienceYears || 0,
          maxExperienceYears: p.maxExperienceYears || 0,
          expectedSalaryMin: p.expectedSalaryMin || 0,
          expectedSalaryMax: p.expectedSalaryMax || 0,
          preferredTechnologies: (p.preferredTechnologies as string[]) || [],
          openToRelocation: p.openToRelocation || false,
          automationMode: p.automationMode || "assisted",
          maxDailyApplications: p.maxDailyApplications || 10,
          requireApprovalBeforeSubmit: p.requireApprovalBeforeSubmit ?? true,
        });
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const savePersonal = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(personalForm),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Profile saved successfully" });
      } else {
        const errorData = await res.json().catch(() => null);
        setMessage({ type: "error", text: errorData?.error || "Failed to save profile" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferencesForm),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Preferences saved" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save preferences" });
    } finally {
      setSaving(false);
    }
  };

  const addExperience = async () => {
    if (!expForm.company || !expForm.title || !expForm.startDate) return;
    const res = await fetch("/api/profile/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expForm),
    });
    if (res.ok) {
      setShowExpForm(false);
      setExpForm({ company: "", title: "", description: "", location: "", startDate: "", endDate: "", isCurrent: false, highlights: [], technologies: [] });
      fetchProfile();
    }
  };

  const deleteExperience = async (id: string) => {
    await fetch(`/api/profile/experiences/${id}`, { method: "DELETE" });
    fetchProfile();
  };

  const addEducation = async () => {
    if (!eduForm.institution || !eduForm.degree) return;
    const res = await fetch("/api/profile/education", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eduForm),
    });
    if (res.ok) {
      setShowEduForm(false);
      setEduForm({ institution: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", gpa: "" });
      fetchProfile();
    }
  };

  const deleteEducation = async (id: string) => {
    await fetch(`/api/profile/education/${id}`, { method: "DELETE" });
    fetchProfile();
  };

  const addSkill = async () => {
    if (!skillForm.name) return;
    const res = await fetch("/api/profile/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skillForm),
    });
    if (res.ok) {
      setSkillForm({ name: "", category: "", proficiencyLevel: 3, yearsOfExperience: 0 });
      fetchProfile();
    }
  };

  const deleteSkill = async (id: string) => {
    await fetch(`/api/profile/skills/${id}`, { method: "DELETE" });
    fetchProfile();
  };

  const addProject = async () => {
    if (!projForm.name) return;
    const res = await fetch("/api/profile/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projForm),
    });
    if (res.ok) {
      setShowProjForm(false);
      setProjForm({ name: "", description: "", url: "", technologies: [], highlights: [] });
      fetchProfile();
    }
  };

  const deleteProject = async (id: string) => {
    await fetch(`/api/profile/projects/${id}`, { method: "DELETE" });
    fetchProfile();
  };

  const addCertification = async () => {
    if (!certForm.name) return;
    const res = await fetch("/api/profile/certifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(certForm),
    });
    if (res.ok) {
      setShowCertForm(false);
      setCertForm({ name: "", issuer: "", issueDate: "" });
      fetchProfile();
    }
  };

  const deleteCertification = async (id: string) => {
    await fetch(`/api/profile/certifications/${id}`, { method: "DELETE" });
    fetchProfile();
  };

  const addLanguage = async () => {
    if (!langForm.name) return;
    const res = await fetch("/api/profile/languages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(langForm),
    });
    if (res.ok) {
      setShowLangForm(false);
      setLangForm({ name: "", proficiencyLevel: "intermediate" });
      fetchProfile();
    }
  };

  const deleteLanguage = async (id: string) => {
    await fetch(`/api/profile/languages/${id}`, { method: "DELETE" });
    fetchProfile();
  };

  const tabs = [
    { id: "personal", label: "Personal Info" },
    { id: "experience", label: "Experience" },
    { id: "education", label: "Education" },
    { id: "skills", label: "Skills" },
    { id: "projects", label: "Projects" },
    { id: "preferences", label: "Preferences" },
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CV Upload */}
      <div className="bg-gradient-to-r from-primary-50 to-indigo-50 border border-primary-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-2">📄 Upload CV / Resume</h3>
        <p className="text-sm text-gray-600 mb-4">Upload your CV (PDF or DOCX) and AI will automatically extract and fill your profile.</p>
        <div
          className="border-2 border-dashed border-primary-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) await uploadCV(f); }}
          onClick={() => {
            const inp = document.createElement("input");
            inp.type = "file";
            inp.accept = ".pdf,.docx,.doc";
            inp.onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) await uploadCV(f); };
            inp.click();
          }}
        >
          {cvUploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="text-sm text-primary-700 font-medium">Parsing CV with AI...</p>
            </div>
          ) : (
            <>
              <svg className="w-12 h-12 mx-auto text-primary-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="text-sm font-medium text-gray-700">Drag & drop your CV here, or click to browse</p>
              <p className="text-xs text-gray-500 mt-1">Supports PDF and DOCX files</p>
            </>
          )}
        </div>
        {cvResult && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">✓ CV parsed successfully!</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-green-700">
              <span>{cvResult.skillsCount} skills</span>
              <span>·</span>
              <span>{cvResult.experienceCount} experiences</span>
              <span>·</span>
              <span>{cvResult.educationCount} education</span>
              <span>·</span>
              <span>{cvResult.projectsCount} projects</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">
          Manage your candidate profile. This is the single source of truth for all AI operations.
        </p>
      </div>

      {message.text && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Personal Info Tab */}
      {activeTab === "personal" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
              <input
                type="text"
                value={personalForm.headline}
                onChange={(e) => setPersonalForm({ ...personalForm, headline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="e.g., Full Stack Developer | Python | Django | React"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={personalForm.phone}
                onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="+91 9876543210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={personalForm.city}
                onChange={(e) => setPersonalForm({ ...personalForm, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="Noida"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={personalForm.state}
                onChange={(e) => setPersonalForm({ ...personalForm, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="Uttar Pradesh"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
              <input
                type="url"
                value={personalForm.linkedinUrl}
                onChange={(e) => setPersonalForm({ ...personalForm, linkedinUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="https://linkedin.com/in/your-profile"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL</label>
              <input
                type="url"
                value={personalForm.githubUrl}
                onChange={(e) => setPersonalForm({ ...personalForm, githubUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="https://github.com/your-username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio URL</label>
              <input
                type="url"
                value={personalForm.portfolioUrl}
                onChange={(e) => setPersonalForm({ ...personalForm, portfolioUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="https://your-portfolio.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Professional Summary</label>
            <textarea
              value={personalForm.professionalSummary}
              onChange={(e) => setPersonalForm({ ...personalForm, professionalSummary: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              placeholder="Brief professional summary..."
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={savePersonal}
              disabled={saving}
              className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Experience Tab */}
      {activeTab === "experience" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Work Experience</h3>
            <button
              onClick={() => setShowExpForm(!showExpForm)}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all"
            >
              + Add Experience
            </button>
          </div>

          {showExpForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                  <input
                    type="text"
                    value={expForm.company}
                    onChange={(e) => setExpForm({ ...expForm, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                  <input
                    type="text"
                    value={expForm.title}
                    onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={expForm.location}
                    onChange={(e) => setExpForm({ ...expForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={expForm.startDate}
                    onChange={(e) => setExpForm({ ...expForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={expForm.endDate}
                    onChange={(e) => setExpForm({ ...expForm, endDate: e.target.value })}
                    disabled={expForm.isCurrent}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none disabled:bg-gray-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isCurrent"
                    checked={expForm.isCurrent}
                    onChange={(e) => setExpForm({ ...expForm, isCurrent: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="isCurrent" className="text-sm text-gray-700">Currently working here</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={expForm.description}
                  onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Achievements / Highlights</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={expHighlightInput}
                    onChange={(e) => setExpHighlightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && expHighlightInput.trim()) {
                        e.preventDefault();
                        setExpForm({ ...expForm, highlights: [...expForm.highlights, expHighlightInput.trim()] });
                        setExpHighlightInput("");
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                    placeholder="Type and press Enter to add..."
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {expForm.highlights.map((h, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                      {h}
                      <button
                        onClick={() => setExpForm({ ...expForm, highlights: expForm.highlights.filter((_, j) => j !== i) })}
                        className="text-blue-400 hover:text-blue-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Technologies Used</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={expTechInput}
                    onChange={(e) => setExpTechInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && expTechInput.trim()) {
                        e.preventDefault();
                        setExpForm({ ...expForm, technologies: [...expForm.technologies, expTechInput.trim()] });
                        setExpTechInput("");
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                    placeholder="e.g., Python, Django, PostgreSQL..."
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {expForm.technologies.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                      {t}
                      <button
                        onClick={() => setExpForm({ ...expForm, technologies: expForm.technologies.filter((_, j) => j !== i) })}
                        className="text-green-400 hover:text-green-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addExperience} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
                  Save Experience
                </button>
                <button onClick={() => setShowExpForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {profile?.experiences?.length === 0 && !showExpForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No experience added yet
            </div>
          )}

          {profile?.experiences?.map((exp) => (
            <div key={exp.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{exp.title}</h4>
                  <p className="text-sm text-gray-600">{exp.company}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(exp.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    {" - "}
                    {exp.isCurrent ? "Present" : exp.endDate ? new Date(exp.endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A"}
                    {exp.location && ` · ${exp.location}`}
                  </p>
                  {exp.description && <p className="text-sm text-gray-500 mt-2">{exp.description}</p>}
                  {exp.highlights && exp.highlights.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {(exp.highlights as string[]).map((h, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-primary-600 mt-1">•</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                  {exp.technologies && exp.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(exp.technologies as string[]).map((t, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteExperience(exp.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Education Tab */}
      {activeTab === "education" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Education</h3>
            <button
              onClick={() => setShowEduForm(!showEduForm)}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all"
            >
              + Add Education
            </button>
          </div>

          {showEduForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institution *</label>
                  <input
                    type="text"
                    value={eduForm.institution}
                    onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Degree *</label>
                  <input
                    type="text"
                    value={eduForm.degree}
                    onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="B.Tech, M.Tech, BCA, MCA..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field of Study</label>
                  <input
                    type="text"
                    value={eduForm.fieldOfStudy}
                    onChange={(e) => setEduForm({ ...eduForm, fieldOfStudy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Computer Science..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GPA / Percentage</label>
                  <input
                    type="text"
                    value={eduForm.gpa}
                    onChange={(e) => setEduForm({ ...eduForm, gpa: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="8.5 CGPA or 85%"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addEducation} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
                  Save
                </button>
                <button onClick={() => setShowEduForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {profile?.education?.map((edu) => (
            <div key={edu.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">{edu.degree}</h4>
                <p className="text-sm text-gray-600">{edu.institution}</p>
                {edu.fieldOfStudy && <p className="text-xs text-gray-500">{edu.fieldOfStudy}</p>}
                {edu.gpa && <p className="text-xs text-gray-400 mt-1">GPA: {edu.gpa}</p>}
              </div>
              <button onClick={() => deleteEducation(edu.id)} className="text-gray-400 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {profile?.education?.length === 0 && !showEduForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No education added yet
            </div>
          )}
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === "skills" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Skills</h3>
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={skillForm.name}
                onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                placeholder="Type a skill and press Enter or click Add..."
              />
              <select
                value={skillForm.category}
                onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              >
                <option value="">Category</option>
                <option value="programming">Programming</option>
                <option value="framework">Framework</option>
                <option value="database">Database</option>
                <option value="devops">DevOps</option>
                <option value="cloud">Cloud</option>
                <option value="tool">Tool</option>
                <option value="soft_skill">Soft Skill</option>
              </select>
              <select
                value={skillForm.proficiencyLevel}
                onChange={(e) => setSkillForm({ ...skillForm, proficiencyLevel: parseInt(e.target.value) })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
              >
                <option value={1}>1 - Beginner</option>
                <option value={2}>2 - Elementary</option>
                <option value={3}>3 - Intermediate</option>
                <option value={4}>4 - Advanced</option>
                <option value={5}>5 - Expert</option>
              </select>
              <button
                onClick={addSkill}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile?.skills?.map((skill) => (
                <span
                  key={skill.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full group"
                >
                  {skill.name}
                  <span className="text-xs text-gray-400">
                    {"★".repeat(skill.proficiencyLevel || 3)}
                  </span>
                  <button
                    onClick={() => deleteSkill(skill.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </span>
              ))}
              {profile?.skills?.length === 0 && (
                <p className="text-sm text-gray-400">No skills added yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
            <button
              onClick={() => setShowProjForm(!showProjForm)}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
            >
              + Add Project
            </button>
          </div>

          {showProjForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                  <input
                    type="text"
                    value={projForm.name}
                    onChange={(e) => setProjForm({ ...projForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                  <input
                    type="url"
                    value={projForm.url}
                    onChange={(e) => setProjForm({ ...projForm, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={projForm.description}
                  onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Technologies</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={projTechInput}
                    onChange={(e) => setProjTechInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && projTechInput.trim()) {
                        e.preventDefault();
                        setProjForm({ ...projForm, technologies: [...projForm.technologies, projTechInput.trim()] });
                        setProjTechInput("");
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                    placeholder="Press Enter to add..."
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {projForm.technologies.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                      {t}
                      <button onClick={() => setProjForm({ ...projForm, technologies: projForm.technologies.filter((_, j) => j !== i) })}>×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addProject} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">Save</button>
                <button onClick={() => setShowProjForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {profile?.projects?.map((proj) => (
            <div key={proj.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">{proj.name}</h4>
                {proj.description && <p className="text-sm text-gray-600 mt-1">{proj.description}</p>}
                {proj.technologies && proj.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(proj.technologies as string[]).map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => deleteProject(proj.id)} className="text-gray-400 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {profile?.projects?.length === 0 && !showProjForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No projects added yet</div>
          )}

          {/* Certifications & Languages inline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            {/* Certifications */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Certifications</h4>
                <button onClick={() => setShowCertForm(!showCertForm)} className="text-sm text-primary-600 hover:text-primary-700">+ Add</button>
              </div>
              {showCertForm && (
                <div className="space-y-3 mb-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={certForm.name}
                    onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    placeholder="Certification name"
                  />
                  <input
                    type="text"
                    value={certForm.issuer}
                    onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    placeholder="Issuer"
                  />
                  <div className="flex gap-2">
                    <button onClick={addCertification} className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg">Save</button>
                    <button onClick={() => setShowCertForm(false)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg">Cancel</button>
                  </div>
                </div>
              )}
              {profile?.certifications?.map((cert) => (
                <div key={cert.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cert.name}</p>
                    {cert.issuer && <p className="text-xs text-gray-500">{cert.issuer}</p>}
                  </div>
                  <button onClick={() => deleteCertification(cert.id)} className="text-gray-400 hover:text-red-500 text-sm">×</button>
                </div>
              ))}
              {profile?.certifications?.length === 0 && <p className="text-sm text-gray-400">None</p>}
            </div>

            {/* Languages */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Languages</h4>
                <button onClick={() => setShowLangForm(!showLangForm)} className="text-sm text-primary-600 hover:text-primary-700">+ Add</button>
              </div>
              {showLangForm && (
                <div className="space-y-3 mb-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={langForm.name}
                    onChange={(e) => setLangForm({ ...langForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    placeholder="Language"
                  />
                  <select
                    value={langForm.proficiencyLevel}
                    onChange={(e) => setLangForm({ ...langForm, proficiencyLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                  >
                    <option value="native">Native</option>
                    <option value="fluent">Fluent</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="basic">Basic</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={addLanguage} className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg">Save</button>
                    <button onClick={() => setShowLangForm(false)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg">Cancel</button>
                  </div>
                </div>
              )}
              {profile?.languages?.map((lang) => (
                <div key={lang.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lang.name}</p>
                    {lang.proficiencyLevel && <p className="text-xs text-gray-500 capitalize">{lang.proficiencyLevel}</p>}
                  </div>
                  <button onClick={() => deleteLanguage(lang.id)} className="text-gray-400 hover:text-red-500 text-sm">×</button>
                </div>
              ))}
              {profile?.languages?.length === 0 && <p className="text-sm text-gray-400">None</p>}
            </div>
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Job Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remote Preference</label>
              <select
                value={preferencesForm.remotePreference}
                onChange={(e) => setPreferencesForm({ ...preferencesForm, remotePreference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">No preference</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select
                value={preferencesForm.employmentPreference}
                onChange={(e) => setPreferencesForm({ ...preferencesForm, employmentPreference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Salary (₹ LPA)</label>
              <input
                type="number"
                value={preferencesForm.expectedSalaryMin}
                onChange={(e) => setPreferencesForm({ ...preferencesForm, expectedSalaryMin: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Salary (₹ LPA)</label>
              <input
                type="number"
                value={preferencesForm.expectedSalaryMax}
                onChange={(e) => setPreferencesForm({ ...preferencesForm, expectedSalaryMax: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Automation Mode</label>
              <select
                value={preferencesForm.automationMode}
                onChange={(e) => setPreferencesForm({ ...preferencesForm, automationMode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="manual">Manual</option>
                <option value="assisted">Assisted (AI prepares, you review)</option>
                <option value="auto">Auto Apply</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Daily Applications</label>
              <input
                type="number"
                value={preferencesForm.maxDailyApplications}
                onChange={(e) => setPreferencesForm({ ...preferencesForm, maxDailyApplications: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="requireApproval"
              checked={preferencesForm.requireApprovalBeforeSubmit}
              onChange={(e) => setPreferencesForm({ ...preferencesForm, requireApprovalBeforeSubmit: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <label htmlFor="requireApproval" className="text-sm text-gray-700">
              Always require my approval before submitting applications
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="openToRelocation"
              checked={preferencesForm.openToRelocation}
              onChange={(e) => setPreferencesForm({ ...preferencesForm, openToRelocation: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <label htmlFor="openToRelocation" className="text-sm text-gray-700">
              Open to relocation
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={savePreferences}
              disabled={saving}
              className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}