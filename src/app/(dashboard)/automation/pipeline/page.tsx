"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Zap, AlertTriangle, RefreshCw, Terminal, Square } from "lucide-react";

type RunEvent = { id: string; level: string; message: string; createdAt: string };
type Run = {
  id: string;
  status: string;
  type: string;
  startedAt: string;
  completedAt?: string;
  result?: {
    jobsFound?: number;
    resumesGenerated?: number;
    applicationsPrepared?: number;
    applicationsSubmitted?: number;
  };
  events: RunEvent[];
};

const STATUS_COLORS: Record<string, string> = {
  running: "text-blue-600 bg-blue-50 border-blue-200",
  completed: "text-emerald-600 bg-emerald-50 border-emerald-200",
  failed: "text-red-600 bg-red-50 border-red-200",
  pending: "text-amber-600 bg-amber-50 border-amber-200",
};

const LOG_COLORS: Record<string, string> = {
  info: "text-neutral-300",
  warn: "text-amber-400",
  error: "text-red-400",
};

export default function AutomationPipelinePage() {
  const [jobTitles, setJobTitles] = useState("");
  const [locations, setLocations] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [maxApplications, setMaxApplications] = useState(10);
  const [minMatchScore, setMinMatchScore] = useState(77);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [run?.events]);

  // Poll active run
  useEffect(() => {
    if (!activeRunId) return;
    pollRef.current = setInterval(() => pollRun(activeRunId), 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRunId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/automation/full-pipeline");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.runs || []);
      }
    } catch {}
  };

  const pollRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/automation/full-pipeline?runId=${runId}`);
      if (res.ok) {
        const data = await res.json();
        setRun(data.run);
        if (data.run?.status === "completed" || data.run?.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setActiveRunId(null);
          fetchHistory();
        }
      }
    } catch {}
  };

  const startPipeline = async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/automation/full-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitles: jobTitles.split(",").map((s) => s.trim()).filter(Boolean),
          locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
          remoteOnly,
          maxApplications,
          minMatchScore,
          autoSubmit,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRunId(data.runId);
        setRun(null);
      } else {
        alert("Failed to start pipeline");
      }
    } catch (err) {
      alert("Error starting pipeline");
    } finally {
      setIsStarting(false);
    }
  };

  const stopPipeline = async () => {
    if (!activeRunId) return;
    try {
      await fetch("/api/automation/stop-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: activeRunId }),
      });
      // Set to cancelled immediately in UI so button updates instantly
      if (run) setRun({ ...run, status: "cancelled" });
      setActiveRunId(null); 
    } catch (err) {
      console.error("Failed to stop pipeline", err);
    }
  };

  const isRunning = run?.status === "running" || (!!activeRunId && run?.status !== "cancelled");

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">🤖 Automated Job Pipeline</h1>
        <p className="text-neutral-500 mt-2 text-sm">Configure and launch the full automation: Job Discovery → AI Resume Tailoring → ATS Optimization → Apply</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config Panel */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-5">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <span>⚙️</span> Pipeline Configuration
          </h2>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Job Titles to Search <span className="text-neutral-400 font-normal">(comma separated, leave blank for AI to decide)</span></label>
            <input type="text" value={jobTitles} onChange={(e) => setJobTitles(e.target.value)}
              placeholder="e.g. Software Engineer, Full Stack Developer, React Developer"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-neutral-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Preferred Locations <span className="text-neutral-400 font-normal">(comma separated)</span></label>
            <input type="text" value={locations} onChange={(e) => setLocations(e.target.value)}
              placeholder="e.g. Bangalore, Remote, Mumbai"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-neutral-50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Max Applications</label>
              <input type="number" min={1} max={50} value={maxApplications} onChange={(e) => setMaxApplications(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-neutral-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Min ATS Score (%)</label>
              <input type="number" min={30} max={100} value={minMatchScore} onChange={(e) => setMinMatchScore(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-neutral-50" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-neutral-700 font-medium">Remote jobs only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={autoSubmit} onChange={(e) => setAutoSubmit(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-neutral-700 font-medium">Auto-submit applications</span>
            </label>
          </div>

          {!autoSubmit && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Applications will be queued for your review before submitting. Check <Link href="/applications" className="underline font-medium">Applications</Link> page to approve.
              </span>
            </p>
          )}

          {isRunning ? (
            <button
              onClick={stopPipeline}
              className="w-full py-3 px-6 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl hover:from-red-600 hover:to-rose-700 transition-all text-sm shadow-lg shadow-red-500/25 flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop Pipeline
            </button>
          ) : (
            <button
              onClick={startPipeline}
              disabled={isStarting}
              className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
            >
              {isStarting ? (
                "Starting..."
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Start Full Automation
                </>
              )}
            </button>
          )}
        </div>

        {/* Live Log Panel */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-700 shadow-xl flex flex-col h-[600px]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700/60 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neutral-400" />
              <h2 className="text-sm font-bold text-white">Live Pipeline Logs</h2>
            </div>
            {run && (
              <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[run.status] || "text-neutral-400 bg-neutral-800 border-neutral-700"}`}>
                {run.status}
              </span>
            )}
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs min-h-0">
            {!run && !activeRunId && (
              <p className="text-neutral-500 italic">Configure the pipeline above and click Start to begin...</p>
            )}
            {activeRunId && !run && (
              <p className="text-blue-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Connecting to pipeline {activeRunId}...
              </p>
            )}
            {run?.events.map((ev) => (
              <div key={ev.id} className={`${LOG_COLORS[ev.level] || "text-neutral-400"} leading-relaxed`}>
                <span className="text-neutral-600">[{new Date(ev.createdAt).toLocaleTimeString()}]</span> {ev.message}
              </div>
            ))}
          </div>
          {/* Stats bar */}
          {run?.result && (
            <div className="border-t border-neutral-700 px-5 py-3 grid grid-cols-4 gap-3 text-center">
              {[
                { label: "Jobs Found", value: run.result.jobsFound || 0, color: "text-blue-400" },
                { label: "Resumes", value: run.result.resumesGenerated || 0, color: "text-purple-400" },
                { label: "Applications", value: run.result.applicationsPrepared || 0, color: "text-amber-400" },
                { label: "Submitted", value: run.result.applicationsSubmitted || 0, color: "text-emerald-400" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">📋 Pipeline History</h2>
          <button onClick={fetchHistory} className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Refresh</button>
        </div>
        {history.length === 0 ? (
          <p className="text-center text-neutral-400 py-10 text-sm">No pipeline runs yet. Start your first automation above!</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {history.map((h) => (
              <div key={h.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[h.status] || ""}`}>{h.status}</span>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Full Pipeline Run</p>
                    <p className="text-xs text-neutral-400">{new Date(h.startedAt).toLocaleString()}</p>
                  </div>
                </div>
                {h.result && (
                  <div className="flex items-center gap-4 text-xs text-neutral-600">
                    <span><strong className="text-neutral-900">{h.result.jobsFound || 0}</strong> jobs found</span>
                    <span><strong className="text-neutral-900">{h.result.resumesGenerated || 0}</strong> resumes</span>
                    <span><strong className="text-neutral-900">{h.result.applicationsPrepared || 0}</strong> applications</span>
                  </div>
                )}
                <Link href="/applications" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
                  View Applications →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
