"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Job = {
  id: string; title: string; location: string | null; remoteType: string | null;
  salaryMin: number | null; requiredSkills: string[]; experienceMin: number | null; isSaved: boolean; createdAt: string;
  company: { name: string } | null;
  matches: Array<{ overallScore: number; rating: string; matchedSkills: string[] }>;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [remoteType, setRemoteType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", remoteType: "", requiredSkills: [] as string[], sourceUrl: "" });
  const [skillInput, setSkillInput] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "20", ...(search && { search }), ...(remoteType && { remoteType }), ...(status && { status }) });
      const res = await fetch(`/api/jobs?${p}`);
      if (res.ok) { const d = await res.json(); setJobs(d.jobs); setTotalPages(d.totalPages); setTotal(d.total); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchJobs(); }, [page, status, remoteType]); // eslint-disable-line

  const addJob = async () => {
    if (!form.title || !form.description) return;
    const res = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowForm(false); setForm({ title: "", description: "", location: "", remoteType: "", requiredSkills: [], sourceUrl: "" }); setPage(1); fetchJobs(); }
  };

  const scoreColor = (s: number) => s >= 70 ? "text-emerald-600" : s >= 50 ? "text-amber-600" : "text-neutral-400";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-medium text-neutral-900">Jobs</h1>
          <p className="text-[13px] text-neutral-500">{total} total</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm">+ Add job</button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="text-[13px] font-medium text-neutral-900">Add job manually</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="input" /></div>
            <div><label className="label">Location</label><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="input" /></div>
          </div>
          <div><label className="label">Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={5} className="input resize-none" /></div>
          <div>
            <label className="label">Skills</label>
            <div className="flex gap-2 mb-2">
              <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && skillInput.trim()) { e.preventDefault(); setForm({...form, requiredSkills: [...form.requiredSkills, skillInput.trim()]}); setSkillInput(""); }}} className="input flex-1" placeholder="Type + Enter" />
            </div>
            <div className="flex flex-wrap gap-1">
              {form.requiredSkills.map((s, i) => (
                <span key={i} className="tag tag-default">{s}<button onClick={() => setForm({...form, requiredSkills: form.requiredSkills.filter((_, j) => j !== i)})} className="ml-1 text-neutral-400 hover:text-neutral-700">×</button></span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addJob} className="btn btn-primary btn-sm">Save</button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={e => { e.preventDefault(); setPage(1); fetchJobs(); }} className="flex gap-2 flex-1 min-w-[260px]">
          <input value={search} onChange={e => setSearch(e.target.value)} className="input flex-1" placeholder="Search jobs..." />
          <button type="submit" className="btn btn-primary btn-sm">Search</button>
        </form>
        <select value={remoteType} onChange={e => { setRemoteType(e.target.value); setPage(1); }} className="input w-auto">
          <option value="">All types</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
        </select>
        {["", "saved", "ignored"].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`btn btn-sm ${status === s ? "btn-primary" : "btn-secondary"}`}>
            {s === "" ? "All" : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-px">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-neutral-100 animate-pulse" />)}</div>
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center"><p className="text-[13px] text-neutral-500">No jobs found.</p></div>
      ) : (
        <div className="card">
          {jobs.map((job, idx) => {
            const match = job.matches[0];
            return (
              <div key={job.id} className={`flex items-center gap-4 px-4 py-3 ${idx > 0 ? "border-t border-neutral-100" : ""} hover:bg-neutral-50`}>
                {match && <div className={`text-center w-12 ${scoreColor(match.overallScore)}`}><p className="text-sm font-medium">{match.overallScore}%</p><p className="text-[10px] uppercase text-neutral-400">{match.rating}</p></div>}
                <div className="flex-1 min-w-0">
                  <Link href={`/jobs/${job.id}`} className="text-[13px] font-medium text-neutral-900 hover:underline">{job.title}</Link>
                  <p className="text-[12px] text-neutral-400">{job.company?.name || "Unknown"}{job.location && ` · ${job.location}`}{job.remoteType === "remote" && " · Remote"}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(job.requiredSkills as string[]).slice(0, 5).map((s, i) => <span key={i} className="tag tag-default">{s}</span>)}
                    {(job.requiredSkills as string[]).length > 5 && <span className="text-[11px] text-neutral-400">+{(job.requiredSkills as string[]).length - 5}</span>}
                  </div>
                </div>
                <button onClick={() => fetch(`/api/jobs/${job.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isSaved: !job.isSaved }) }).then(() => fetchJobs())}
                  className={`btn btn-ghost btn-sm ${job.isSaved ? "text-amber-500" : "text-neutral-300"}`}>{job.isSaved ? "★" : "☆"}</button>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn btn-ghost btn-sm">← Previous</button>
          <span className="text-[12px] text-neutral-400">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn btn-ghost btn-sm">Next →</button>
        </div>
      )}
    </div>
  );
}