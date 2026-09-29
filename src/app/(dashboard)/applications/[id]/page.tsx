"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Application = {
  id: string;
  status: string;
  createdAt: string;
  appliedAt: string | null;
  notes: string | null;
  formFields: Record<string, unknown>;
  job: {
    id: string;
    title: string;
    description: string;
    location: string | null;
    remoteType: string | null;
    company: { id: string; name: string } | null;
  };
  resume: { id: string; title: string } | null;
  coverLetter: { id: string; title: string; content: string } | null;
  questions: Array<{
    id: string;
    questionText: string;
    questionType: string;
    isRequired: boolean;
    answers: Array<{
      id: string;
      answerText: string;
      aiGenerated: boolean;
      approved: boolean;
    }>;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    description: string;
    createdAt: string;
  }>;
};

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingResume, setGeneratingResume] = useState(false);

  const fetchApplication = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setApplication(data.application);
      }
    } catch (err) {
      console.error("Failed to load application:", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const updateStatus = async (status: string) => {
    setUpdatingStatus(true);
    try {
      await fetch(`/api/applications/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchApplication();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const generateCoverLetter = async () => {
    if (!application) return;
    setGeneratingCover(true);
    try {
      const res = await fetch("/api/ai/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: application.job.id,
          resumeId: application.resume?.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetch(`/api/applications/${params.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverLetterId: data.id }),
        });
        fetchApplication();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to generate cover letter");
      }
    } finally {
      setGeneratingCover(false);
    }
  };

  const generateResume = async () => {
    if (!application) return;
    setGeneratingResume(true);
    try {
      const res = await fetch("/api/ai/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: application.job.id,
          template: "job_specific",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetch(`/api/applications/${params.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId: data.id }),
        });
        fetchApplication();
      }
    } finally {
      setGeneratingResume(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-700 border-gray-200";
      case "pending_review": return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "approved": return "bg-blue-50 text-blue-700 border-blue-200";
      case "submitted": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "interview": return "bg-green-50 text-green-700 border-green-200";
      case "offer": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "rejected": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700">Application not found</h2>
        <Link href="/applications" className="text-primary-600 mt-2 inline-block">Back to Applications</Link>
      </div>
    );
  }

  const statusFlow = ["draft", "pending_review", "approved", "submitted", "viewed", "interview", "offer", "accepted"];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/applications" className="hover:text-primary-600">Applications</Link>
        <span>/</span>
        <span className="text-gray-900">{application.job.title}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{application.job.title}</h1>
            <p className="text-lg text-gray-600 mt-1">
              {application.job.company?.name || "Unknown Company"}
              {application.job.location && ` · ${application.job.location}`}
            </p>
          </div>
          <span className={`px-4 py-2 text-sm font-semibold rounded-lg border capitalize ${statusColor(application.status)}`}>
            {application.status.replace("_", " ")}
          </span>
        </div>

        {/* Status Flow */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-200">
          {statusFlow.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              disabled={updatingStatus || application.status === s}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                application.status === s
                  ? "bg-primary-100 text-primary-700 border-primary-200 cursor-default"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-primary-300"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resume & Cover Letter */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Resume</h4>
                {application.resume ? (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <Link href={`/resumes/${application.resume.id}`} className="text-sm text-primary-600 hover:underline">
                      {application.resume.title}
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">No resume attached</p>
                    <button
                      onClick={generateResume}
                      disabled={generatingResume}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {generatingResume ? "Generating..." : "🤖 Generate AI Resume"}
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Cover Letter</h4>
                {application.coverLetter ? (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <Link href={`/cover-letters`} className="text-sm text-primary-600 hover:underline">
                      {application.coverLetter.title}
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">No cover letter</p>
                    <button
                      onClick={generateCoverLetter}
                      disabled={generatingCover}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {generatingCover ? "Generating..." : "🤖 Generate Cover Letter"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Questions */}
          {application.questions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Application Questions</h3>
              <div className="space-y-4">
                {application.questions.map((q) => (
                  <div key={q.id} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">{q.questionText}</p>
                    {q.answers.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-sm text-gray-900">{q.answers[0].answerText}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {q.answers[0].aiGenerated && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded">AI Generated</span>
                          )}
                          {q.answers[0].approved && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">Approved</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1">Not answered yet</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cover Letter Preview */}
          {application.coverLetter && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Cover Letter</h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {application.coverLetter.content}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h4 className="font-semibold text-gray-900">Actions</h4>
            <Link
              href={`/jobs/${application.job.id}`}
              className="block w-full text-center px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all"
            >
              View Job Details
            </Link>

            {/* Browser Automation */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Browser Automation</h5>
              <button
                onClick={async () => {
                  const res = await fetch("/api/automation/prepare-application", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ applicationId: application.id }),
                  });
                  const data = await res.json();
                  if (data.result?.status === "captcha_paused") {
                    alert("CAPTCHA detected! Manual intervention required. Check the screenshot in the application.");
                  } else if (data.result?.success) {
                    alert("Application form filled! Review and approve for submission.");
                  } else {
                    alert(data.error || data.result?.failureReason || "Preparation completed with issues.");
                  }
                  fetchApplication();
                }}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all mb-2"
              >
                🤖 Auto-Fill with Playwright
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Are you sure you want to submit this application?")) return;
                  const res = await fetch("/api/automation/submit-application", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ applicationId: application.id, approved: true }),
                  });
                  const data = await res.json();
                  if (data.result?.success) {
                    alert("Application submitted successfully!");
                  } else {
                    alert(data.error || data.result?.failureReason || "Submission had issues.");
                  }
                  fetchApplication();
                }}
                disabled={!["approved", "pending_review"].includes(application.status)}
                className="w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                🚀 Submit Application
              </button>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <button
                onClick={() => updateStatus("approved")}
                disabled={application.status === "approved"}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all mb-2"
              >
                ✓ Approve for Submission
              </button>
              <button
                onClick={() => updateStatus("submitted")}
                disabled={application.status === "submitted"}
                className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all mb-2"
              >
                Mark as Submitted
              </button>
              <button
                onClick={() => updateStatus("rejected")}
                disabled={application.status === "rejected"}
                className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                Mark as Rejected
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-900 mb-4">Activity Timeline</h4>
            <div className="space-y-3">
              {application.events.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="w-2 h-2 mt-2 bg-primary-500 rounded-full flex-shrink-0"></div>
                  <div>
                    <p className="text-sm text-gray-900">{event.description || event.eventType}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {application.events.length === 0 && (
                <p className="text-sm text-gray-400">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}