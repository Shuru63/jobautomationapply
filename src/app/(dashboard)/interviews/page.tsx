"use client";

import { useState, useEffect, useCallback } from "react";

type Interview = {
  id: string;
  roundNumber: number;
  roundType: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  meetingUrl: string | null;
  interviewerName: string | null;
  interviewerEmail: string | null;
  status: string;
  notes: string | null;
  feedback: string | null;
  rating: number | null;
  application: {
    id: string;
    job: { id: string; title: string; company: { name: string } | null };
  };
  preparation: {
    companyResearch: string | null;
    roleAnalysis: string | null;
    technicalTopics: string[];
    behavioralQuestions: string[];
    technicalQuestions: string[];
    projectQuestions: string[];
    questionsToAsk: string[];
    resumeTopics: string[];
  } | null;
};

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPrep, setGeneratingPrep] = useState<string | null>(null);
  const [expandedPrep, setExpandedPrep] = useState<string | null>(null);

  const fetchInterviews = useCallback(async () => {
    try {
      const res = await fetch("/api/interviews");
      if (res.ok) {
        const data = await res.json();
        setInterviews(data.interviews);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInterviews();
  }, [fetchInterviews]);

  const generatePrep = async (interviewId: string, applicationId: string) => {
    setGeneratingPrep(interviewId);
    try {
      const res = await fetch("/api/ai/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, applicationId }),
      });
      if (res.ok) {
        fetchInterviews();
        setExpandedPrep(interviewId);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to generate interview preparation");
      }
    } catch {
      alert("Failed to generate interview preparation");
    } finally {
      setGeneratingPrep(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-700";
      case "completed": return "bg-green-100 text-green-700";
      case "cancelled": return "bg-gray-100 text-gray-500";
      case "rescheduled": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const roundTypeIcon = (type: string | null) => {
    switch (type) {
      case "phone": return "📞";
      case "technical": return "💻";
      case "hr": return "👥";
      case "system_design": return "🏗️";
      case "behavioral": return "🧠";
      default: return "📋";
    }
  };

  if (loading) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
        <p className="text-gray-500 mt-1">{interviews.length} interview{interviews.length !== 1 ? "s" : ""}</p>
      </div>

      {interviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <h3 className="text-lg font-semibold text-gray-700">No interviews scheduled</h3>
          <p className="text-sm text-gray-500 mt-1">Interviews will appear here when applications reach the interview stage</p>
        </div>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview) => (
            <div key={interview.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-4">
                <div className="text-3xl">{roundTypeIcon(interview.roundType)}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {interview.application.job.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {interview.application.job.company?.name || "Unknown"} · Round {interview.roundNumber}
                        {interview.roundType && ` · ${interview.roundType.replace("_", " ")}`}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${statusColor(interview.status)}`}>
                      {interview.status}
                    </span>
                  </div>
                  {interview.scheduledAt && (
                    <p className="text-sm text-gray-500 mt-2">
                      📅 {new Date(interview.scheduledAt).toLocaleString()}
                      {interview.durationMinutes && ` (${interview.durationMinutes} min)`}
                    </p>
                  )}
                  {interview.meetingUrl && (
                    <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline mt-1 inline-block">
                      🔗 Join Meeting
                    </a>
                  )}
                  {interview.interviewerName && (
                    <p className="text-sm text-gray-500 mt-1">👤 {interview.interviewerName}</p>
                  )}
                  {interview.notes && (
                    <p className="text-sm text-gray-600 mt-2 p-3 bg-gray-50 rounded-lg">{interview.notes}</p>
                  )}
                  {interview.rating && (
                    <div className="flex items-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <span key={r} className={`text-lg ${r <= interview.rating! ? "text-yellow-400" : "text-gray-300"}`}>★</span>
                      ))}
                    </div>
                  )}

                  {/* Interview Preparation */}
                  <div className="mt-4 flex gap-2">
                    {interview.preparation ? (
                      <button
                        onClick={() => setExpandedPrep(expandedPrep === interview.id ? null : interview.id)}
                        className="px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-all"
                      >
                        {expandedPrep === interview.id ? "Hide Preparation" : "📖 View Preparation"}
                      </button>
                    ) : (
                      <button
                        onClick={() => generatePrep(interview.id, interview.application.id)}
                        disabled={generatingPrep === interview.id}
                        className="px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
                      >
                        {generatingPrep === interview.id ? "Generating..." : "🤖 Generate AI Preparation"}
                      </button>
                    )}
                  </div>

                  {/* Expanded Preparation */}
                  {expandedPrep === interview.id && interview.preparation && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                      {interview.preparation.companyResearch && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">Company Research</h5>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{interview.preparation.companyResearch}</p>
                        </div>
                      )}
                      {interview.preparation.roleAnalysis && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">Role Analysis</h5>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{interview.preparation.roleAnalysis}</p>
                        </div>
                      )}
                      {interview.preparation.technicalTopics.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">Technical Topics</h5>
                          <div className="flex flex-wrap gap-1.5">
                            {interview.preparation.technicalTopics.map((t, i) => (
                              <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {interview.preparation.behavioralQuestions.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">Behavioral Questions</h5>
                          <ul className="space-y-1">
                            {interview.preparation.behavioralQuestions.map((q, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-purple-500">Q{i + 1}.</span>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {interview.preparation.technicalQuestions.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">Technical Questions</h5>
                          <ul className="space-y-1">
                            {interview.preparation.technicalQuestions.map((q, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-blue-500">T{i + 1}.</span>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {interview.preparation.projectQuestions.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">Project Questions</h5>
                          <ul className="space-y-1">
                            {interview.preparation.projectQuestions.map((q, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-green-500">P{i + 1}.</span>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {interview.preparation.questionsToAsk.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">Questions to Ask Interviewer</h5>
                          <ul className="space-y-1">
                            {interview.preparation.questionsToAsk.map((q, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-amber-500">→</span>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}