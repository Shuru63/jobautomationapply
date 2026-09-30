"use client";

import { useState, useEffect } from "react";

type Resume = {
  id: string; title: string; template: string; isActive: boolean; version: number; createdAt: string;
  job: { id: string; title: string; company: { name: string } | null } | null;
  content: { summary?: string; skills?: string[] } | null;
};

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Resume | null>(null);

  const fetchResumes = async () => {
    try { const r = await fetch("/api/resumes"); if (r.ok) { const d = await r.json(); setResumes(d.resumes); } } catch {} finally { setLoading(false); }
  };
  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResumes(); 
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await fetch("/api/ai/generate-resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: "master" }) });
      if (r.ok) { fetchResumes(); } else { const d = await r.json(); alert(d.error || "Generation failed"); }
    } finally { setGenerating(false); }
  };

  const tplLabel = (t: string) => t.replace("_", " ");

  if (loading) return <div className="space-y-px">{[1,2].map(i => <div key={i} className="h-20 bg-[var(--color-surface-tertiary)] animate-pulse" />)}</div>;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-[var(--color-text-primary)]">Resumes</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{resumes.length} generated</p>
        </div>
        <button onClick={generate} disabled={generating} className="px-4 py-2 bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
          {generating ? "Generating..." : "Generate master resume"}
        </button>
      </div>

      {resumes.length === 0 ? (
        <div className="bg-white border border-[var(--color-border)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No resumes yet.</p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Complete your profile, then generate a resume.</p>
        </div>
      ) : (
        <div className="bg-white border border-[var(--color-border)]">
          {resumes.map((r, idx) => (
            <div key={r.id} onClick={() => setSelected(r)}
              className={`px-5 py-4 cursor-pointer hover:bg-[var(--color-surface-secondary)] ${idx > 0 ? "border-t border-[var(--color-border)]" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{r.title}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">v{r.version} · {tplLabel(r.template)} · {new Date(r.createdAt).toLocaleDateString()}</p>
                  {r.job && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">For: {r.job.title} at {r.job.company?.name}</p>}
                </div>
                <div className="flex gap-2">
                  <a href={`/api/resumes/${r.id}/export?format=pdf`} onClick={e => e.stopPropagation()}
                    className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] no-underline">PDF</a>
                  <a href={`/api/resumes/${r.id}/export?format=docx`} onClick={e => e.stopPropagation()}
                    className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] no-underline">DOCX</a>
                </div>
              </div>
              {r.content?.skills && r.content.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.content.skills.slice(0, 8).map((s, i) => (
                    <span key={i} className="text-[11px] px-1.5 py-0.5 bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">{s}</span>
                  ))}
                  {r.content.skills.length > 8 && <span className="text-[11px] text-[var(--color-text-tertiary)]">+{r.content.skills.length - 8}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && selected.content && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white border border-[var(--color-border)] max-w-3xl w-full max-h-[85vh] overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">{selected.title}</h2>
                <div className="flex gap-2 mt-2">
                  <a href={`/api/resumes/${selected.id}/export?format=pdf`} className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] no-underline">Download PDF</a>
                  <a href={`/api/resumes/${selected.id}/export?format=docx`} className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] no-underline">Download DOCX</a>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-lg">×</button>
            </div>
            {selected.content.summary && <p className="text-sm text-[var(--color-text-secondary)] mb-4">{selected.content.summary}</p>}
            {selected.content.skills && selected.content.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selected.content.skills.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}