"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Job = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  remoteType: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceMin: number | null;
  experienceMax: number | null;
  source: string;
  sourceUrl: string | null;
  isSaved: boolean;
  notes: string | null;
  createdAt: string;
  company: { id: string; name: string; description: string | null; websiteUrl: string | null; careersUrl: string | null } | null;
  matches: Array<{
    id: string;
    overallScore: number;
    rating: string;
    matchedSkills: string[];
    missingSkills: string[];
    atsKeywords: string[];
    reasoning: string;
    recommendApplication: boolean;
    strengthsAndWeaknesses: {
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    } | null;
  }>;
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [creatingApp, setCreatingApp] = useState(false);
  const [generatingResume, setGeneratingResume] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
      }
    } catch (err) {
      console.error("Failed to load job:", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const analyzeJob = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ai/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: params.id }),
      });
      if (res.ok) {
        fetchJob();
      } else {
        const data = await res.json();
        alert(data.error || "Analysis failed. Make sure GEMINI_API_KEY is set.");
      }
    } catch {
      alert("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const createApplication = async () => {
    setCreatingApp(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: params.id }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/applications/${data.id}`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create application");
      }
    } finally {
      setCreatingApp(false);
    }
  };

  const generateResume = async () => {
    setGeneratingResume(true);
    try {
      const res = await fetch("/api/ai/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: params.id, template: "job_specific" }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Resume generated: ${data.title}`);
        router.push(`/resumes/${data.id}`);
      } else {
        const data = await res.json();
        alert(data.error || "Resume generation failed. Make sure GEMINI_API_KEY is set.");
      }
    } finally {
      setGeneratingResume(false);
    }
  };

  const toggleSave = async () => {
    if (!job) return;
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSaved: !job.isSaved }),
    });
    fetchJob();
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700">Job not found</h2>
        <Link href="/jobs" className="text-primary-600 mt-2 inline-block">Back to Jobs</Link>
      </div>
    );
  }

  const match = job.matches[0];

  const ratingColor = (rating: string) => {
    switch (rating) {
      case "excellent": return "from-emerald-500 to-green-600";
      case "strong": return "from-green-500 to-emerald-600";
      case "good": return "from-blue-500 to-indigo-600";
      case "fair": return "from-yellow-500 to-amber-600";
      case "weak": return "from-orange-500 to-red-500";
      case "poor": return "from-red-500 to-red-600";
      default: return "from-gray-400 to-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/jobs" className="hover:text-primary-600">Jobs</Link>
        <span>/</span>
        <span className="text-gray-900">{job.title}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
            <p className="text-lg text-gray-600 mt-1">{job.company?.name || "Unknown Company"}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
              {job.location && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
              )}
              {job.remoteType && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  job.remoteType === "remote" ? "bg-green-100 text-green-700" :
                  job.remoteType === "hybrid" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {job.remoteType.charAt(0).toUpperCase() + job.remoteType.slice(1)}
                </span>
              )}
              {job.salaryMin && (
                <span>₹{job.salaryMin}L - ₹{job.salaryMax || "?"}L per annum</span>
              )}
              {job.experienceMin !== null && (
                <span>{job.experienceMin}-{job.experienceMax || "+"} years experience</span>
              )}
            </div>
          </div>

          {/* Match Score */}
          {match && (
            <div className={`bg-gradient-to-br ${ratingColor(match.rating)} rounded-xl p-5 text-white text-center min-w-[140px]`}>
              <p className="text-sm opacity-90">Match Score</p>
              <p className="text-4xl font-bold mt-1">{match.overallScore}%</p>
              <p className="text-sm font-medium mt-1 capitalize">{match.rating}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={analyzeJob}
            disabled={analyzing}
            className="px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
          >
            {analyzing ? "Analyzing..." : "🤖 AI Analyze Match"}
          </button>
          <button
            onClick={generateResume}
            disabled={generatingResume}
            className="px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all"
          >
            {generatingResume ? "Generating..." : "📄 Generate Resume"}
          </button>
          <button
            onClick={createApplication}
            disabled={creatingApp}
            className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            {creatingApp ? "Creating..." : "📝 Prepare Application"}
          </button>
          <button
            onClick={toggleSave}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
              job.isSaved
                ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {job.isSaved ? "★ Saved" : "☆ Save Job"}
          </button>
          {job.sourceUrl && (
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all"
            >
              View Original ↗
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Match Details */}
          {match && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Match Analysis</h3>

              {/* Score Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {[
                  { label: "Skills", score: match.overallScore },
                  { label: "Overall", score: match.overallScore },
                ].map((item) => (
                  <div key={item.label} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-lg font-bold text-gray-900">{item.score}%</p>
                  </div>
                ))}
              </div>

              {/* Matched Skills */}
              {match.matchedSkills && match.matchedSkills.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-green-700 mb-2">✓ Matched Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {match.matchedSkills.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Skills */}
              {match.missingSkills && match.missingSkills.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-red-700 mb-2">✗ Missing Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {match.missingSkills.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ATS Keywords */}
              {match.atsKeywords && match.atsKeywords.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-blue-700 mb-2">🔑 ATS Keywords</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {match.atsKeywords.map((kw, i) => (
                      <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              {match.strengthsAndWeaknesses && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h5 className="text-xs font-medium text-green-800 mb-2">Strengths</h5>
                    <ul className="space-y-1">
                      {match.strengthsAndWeaknesses.strengths?.map((s, i) => (
                        <li key={i} className="text-xs text-green-700 flex items-start gap-1">
                          <span>•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <h5 className="text-xs font-medium text-red-800 mb-2">Weaknesses</h5>
                    <ul className="space-y-1">
                      {match.strengthsAndWeaknesses.weaknesses?.map((w, i) => (
                        <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                          <span>•</span> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h5 className="text-xs font-medium text-blue-800 mb-2">Recommendations</h5>
                    <ul className="space-y-1">
                      {match.strengthsAndWeaknesses.recommendations?.map((r, i) => (
                        <li key={i} className="text-xs text-blue-700 flex items-start gap-1">
                          <span>•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Reasoning */}
              {match.reasoning && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h5 className="text-xs font-medium text-gray-700 mb-1">AI Reasoning</h5>
                  <p className="text-sm text-gray-600">{match.reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Job Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h3>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {job.description}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Required Skills */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-900 mb-3">Required Skills</h4>
            <div className="flex flex-wrap gap-1.5">
              {(job.requiredSkills as string[]).map((skill, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-1 text-xs rounded-full ${
                    match?.matchedSkills?.includes(skill.toLowerCase())
                      ? "bg-green-100 text-green-700 border border-green-200"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {skill}
                </span>
              ))}
              {(job.requiredSkills as string[]).length === 0 && (
                <p className="text-sm text-gray-400">None specified</p>
              )}
            </div>
          </div>

          {/* Preferred Skills */}
          {(job.preferredSkills as string[]).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-3">Preferred Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {(job.preferredSkills as string[]).map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Company Info */}
          {job.company && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-3">Company</h4>
              <Link href={`/companies/${job.company.id}`} className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                {job.company.name}
              </Link>
              {job.company.description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-4">{job.company.description}</p>
              )}
              <div className="flex flex-col gap-2 mt-3">
                {job.company.websiteUrl && (
                  <a href={job.company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">
                    Website ↗
                  </a>
                )}
                {job.company.careersUrl && (
                  <a href={job.company.careersUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">
                    Careers Page ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Job Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-900 mb-3">Details</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Source</dt>
                <dd className="text-gray-900 capitalize">{job.source}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Added</dt>
                <dd className="text-gray-900">{new Date(job.createdAt).toLocaleDateString()}</dd>
              </div>
              {job.employmentType && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="text-gray-900 capitalize">{job.employmentType.replace("_", " ")}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}