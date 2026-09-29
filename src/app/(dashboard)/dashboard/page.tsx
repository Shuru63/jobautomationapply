"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Stats = { totalJobs: number; matchedJobs: number; totalApplications: number; submittedApplications: number; interviewApplications: number; offerApplications: number; todayApplications: number };
type App = { id: string; status: string; createdAt: string; job: { title: string; company: { name: string } | null } };
type Match = { id: string; overallScore: number; rating: string; job: { title: string; company: { name: string } | null } };

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(d => { setStats(d.stats); setApps(d.recentApplications); setMatches(d.topMatches); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-px">{[1,2,3].map(i => <div key={i} className="h-16 bg-neutral-100 animate-pulse" />)}</div>;

  const statusTag = (s: string) => {
    const m: Record<string, string> = { submitted: "tag-info", interview: "tag-success", pending_review: "tag-warning", rejected: "tag-danger", offer: "tag-success", draft: "tag-default" };
    return m[s] || "tag-default";
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-base font-medium text-neutral-900">Dashboard</h1>
        <p className="text-[13px] text-neutral-500 mt-0.5">Overview of your job search.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-200">
        {[
          { l: "Jobs", v: stats?.totalJobs || 0, s: `${stats?.matchedJobs || 0} matched` },
          { l: "Applications", v: stats?.totalApplications || 0, s: `${stats?.submittedApplications || 0} submitted` },
          { l: "Interviews", v: stats?.interviewApplications || 0, s: `${stats?.offerApplications || 0} offers` },
          { l: "Today", v: stats?.todayApplications || 0, s: "applications" },
        ].map(s => (
          <div key={s.l} className="bg-white p-4">
            <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">{s.l}</p>
            <p className="text-xl font-medium text-neutral-900 mt-1">{s.v}</p>
            <p className="text-[12px] text-neutral-400">{s.s}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-neutral-200">
        <div className="bg-white">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-neutral-900">Top matches</h3>
            <Link href="/jobs" className="text-[12px] text-neutral-500 hover:text-neutral-900">View all</Link>
          </div>
          {matches.length === 0 ? (
            <p className="text-[13px] text-neutral-400 px-4 py-8 text-center">No matches yet.</p>
          ) : matches.map(m => (
            <Link key={m.id} href={`/jobs/${m.id}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-50 last:border-0 hover:bg-neutral-50 no-underline">
              <span className={`text-sm font-medium w-10 text-center ${m.overallScore >= 70 ? "text-emerald-600" : m.overallScore >= 50 ? "text-amber-600" : "text-neutral-400"}`}>{m.overallScore}%</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-neutral-900 truncate">{m.job.title}</p>
                <p className="text-[11px] text-neutral-400">{m.job.company?.name}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-white">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-neutral-900">Recent applications</h3>
            <Link href="/applications" className="text-[12px] text-neutral-500 hover:text-neutral-900">View all</Link>
          </div>
          {apps.length === 0 ? (
            <p className="text-[13px] text-neutral-400 px-4 py-8 text-center">No applications yet.</p>
          ) : apps.map(a => (
            <Link key={a.id} href={`/applications/${a.id}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-50 last:border-0 hover:bg-neutral-50 no-underline">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-neutral-900 truncate">{a.job.title}</p>
                <p className="text-[11px] text-neutral-400">{a.job.company?.name}</p>
              </div>
              <span className={`tag ${statusTag(a.status)}`}>{a.status.replace("_", " ")}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-200">
        {[
          { href: "/profile", l: "Upload CV", s: "Parse and fill profile" },
          { href: "/jobs", l: "Browse jobs", s: "Find opportunities" },
          { href: "/resumes", l: "AI Resume", s: "Generate tailored resume" },
          { href: "/analytics", l: "Analytics", s: "View statistics" },
        ].map(a => (
          <Link key={a.href} href={a.href} className="bg-white p-4 hover:bg-neutral-50 no-underline">
            <p className="text-[13px] font-medium text-neutral-900">{a.l}</p>
            <p className="text-[12px] text-neutral-400 mt-0.5">{a.s}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}