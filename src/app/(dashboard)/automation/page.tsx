"use client";

import { useState, useEffect } from "react";

type AutomationRun = {
  id: string;
  type: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  result: {
    jobsFound?: number;
    duplicatesFiltered?: number;
    validJobs?: number;
    matchedJobs?: number;
    resumesGenerated?: number;
    applicationsPrepared?: number;
    applicationsSubmitted?: number;
    errors?: string[];
  } | null;
  error: string | null;
  events: Array<{
    id: string;
    level: string;
    message: string;
    createdAt: string;
  }>;
  createdAt: string;
};

export default function AutomationPage() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [creatingRun, setCreatingRun] = useState(false);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automation/runs?limit=20");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const createRun = async (type: string) => {
    setCreatingRun(true);
    try {
      const res = await fetch("/api/automation/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        fetchRuns();
      }
    } finally {
      setCreatingRun(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "running": return "bg-blue-100 text-blue-700";
      case "completed": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      case "cancelled": return "bg-gray-100 text-gray-500";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "error": return "text-red-600";
      case "warn": return "text-yellow-600";
      default: return "text-gray-500";
    }
  };

  const duration = (run: AutomationRun) => {
    if (!run.startedAt) return "Not started";
    const start = new Date(run.startedAt).getTime();
    const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  if (loading) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation</h1>
          <p className="text-gray-500 mt-1">{total} automation runs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => createRun("job_search")}
            disabled={creatingRun}
            className="px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            🔍 Job Search Run
          </button>
          <button
            onClick={() => createRun("matching")}
            disabled={creatingRun}
            className="px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            🎯 Matching Run
          </button>
        </div>
      </div>

      {/* Automation Settings Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-900 mb-2">Automation Pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-white rounded-lg border border-blue-100">
            <p className="font-medium text-blue-900">🔍 Job Discovery</p>
            <p className="text-xs text-blue-600 mt-1">Search career pages &amp; APIs</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-blue-100">
            <p className="font-medium text-blue-900">🎯 AI Matching</p>
            <p className="text-xs text-blue-600 mt-1">Score &amp; rank jobs</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-blue-100">
            <p className="font-medium text-blue-900">📄 Resume Gen</p>
            <p className="text-xs text-blue-600 mt-1">Tailored resumes per job</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-blue-100">
            <p className="font-medium text-blue-900">📝 Application</p>
            <p className="text-xs text-blue-600 mt-1">Prepare &amp; submit</p>
          </div>
        </div>
      </div>

      {/* Runs List */}
      {runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <h3 className="text-lg font-semibold text-gray-700">No automation runs yet</h3>
          <p className="text-sm text-gray-500 mt-1">Start a job search or matching run to see results here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${statusColor(run.status)}`}>
                    {run.status}
                  </span>
                  <span className="text-sm font-medium text-gray-900 capitalize">{run.type.replace("_", " ")}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{duration(run)}</span>
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Result Summary */}
              {run.result && (
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  {run.result.jobsFound !== undefined && (
                    <span className="text-gray-600">Found: <strong>{run.result.jobsFound}</strong></span>
                  )}
                  {run.result.matchedJobs !== undefined && (
                    <span className="text-gray-600">Matched: <strong className="text-green-600">{run.result.matchedJobs}</strong></span>
                  )}
                  {run.result.applicationsPrepared !== undefined && (
                    <span className="text-gray-600">Prepared: <strong>{run.result.applicationsPrepared}</strong></span>
                  )}
                  {run.result.applicationsSubmitted !== undefined && (
                    <span className="text-gray-600">Submitted: <strong className="text-blue-600">{run.result.applicationsSubmitted}</strong></span>
                  )}
                </div>
              )}

              {run.error && (
                <p className="text-sm text-red-600 mt-2">Error: {run.error}</p>
              )}

              {/* Events */}
              {selectedRun?.id === run.id && run.events.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase">Events</h4>
                  {run.events.map((event) => (
                    <div key={event.id} className="flex gap-3 text-sm">
                      <span className={`font-mono text-xs ${levelColor(event.level)}`}>[{event.level}]</span>
                      <span className="text-gray-700">{event.message}</span>
                      <span className="text-xs text-gray-400 ml-auto">{new Date(event.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}