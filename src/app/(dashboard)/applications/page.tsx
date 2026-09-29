"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type App = { id: string; status: string; createdAt: string; appliedAt: string | null; job: { id: string; title: string; location: string | null; company: { name: string } | null }; resume: { title: string } | null };

const filters = ["", "draft", "pending_review", "submitted", "interview", "offer", "rejected"];

export default function ApplicationsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/applications?limit=50${filter ? `&status=${filter}` : ""}`).then(r => r.json()).then(d => { setApps(d.applications); setTotal(d.total); }).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  const statusStyle = (s: string) => {
    const m: Record<string, string> = {
      draft: "bg-gray-50 text-gray-600", pending_review: "bg-amber-50 text-amber-700",
      submitted: "bg-blue-50 text-blue-700", interview: "bg-emerald-50 text-emerald-700",
      offer: "bg-green-50 text-green-700", rejected: "bg-red-50 text-red-700",
    };
    return m[s] || "bg-gray-50 text-gray-600";
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-lg font-medium text-[var(--color-text-primary)]">Applications</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{total} total</p>
      </div>

      <div className="flex gap-1">
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium border ${filter === f ? "bg-[var(--color-surface-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border-strong)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"}`}>
            {f === "" ? "All" : f.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-px">{[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--color-surface-tertiary)] animate-pulse" />)}</div>
      ) : apps.length === 0 ? (
        <div className="bg-white border border-[var(--color-border)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No applications found.</p>
          <Link href="/jobs" className="text-sm text-[var(--color-link)] mt-2 inline-block">Browse jobs</Link>
        </div>
      ) : (
        <div className="bg-white border border-[var(--color-border)]">
          {apps.map((a, idx) => (
            <Link key={a.id} href={`/applications/${a.id}`}
              className={`flex items-center gap-4 px-5 py-3.5 ${idx > 0 ? "border-t border-[var(--color-border)]" : ""} hover:bg-[var(--color-surface-secondary)] no-underline`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{a.job.title}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">{a.job.company?.name || "Unknown"} · {new Date(a.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 capitalize ${statusStyle(a.status)}`}>{a.status.replace("_", " ")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}