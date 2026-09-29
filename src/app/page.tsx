import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-[15px] font-medium tracking-tight text-neutral-900">JobPilot</Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-neutral-500 hover:text-neutral-900">Sign in</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Get started</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        <section className="pt-5 pb-5 max-w-xl">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest mb-4">AI-Powered</p>
          <h1 className="text-[36px] leading-[1.15] font-medium text-neutral-900 tracking-tight">
            Automate your<br />job search
          </h1>
          <p className="mt-4 text-[15px] text-neutral-500 leading-relaxed">
            Upload your CV. AI extracts your profile, discovers jobs, scores matches, generates tailored resumes, and prepares applications.
          </p>
          <div className="flex items-center gap-3 mt-8">
            <Link href="/register" className="btn btn-primary">Start automating</Link>
            <Link href="/login" className="btn btn-secondary">Sign in</Link>
          </div>
        </section>

        <section className="border-t border-neutral-200 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-neutral-200">
            {[
              { t: "CV Intelligence", d: "Upload PDF or DOCX. AI extracts skills, experience, and builds your structured profile." },
              { t: "Job Matching", d: "Deterministic scoring across skills, experience, location, salary. AI reasoning for every match." },
              { t: "Resume Generation", d: "Each job gets a tailored ATS-optimized resume. AI rewrites — never fabricates." },
              { t: "Cover Letters", d: "Personalized per application using your verified data and the job description." },
              { t: "Application Automation", d: "Playwright fills forms, detects CAPTCHAs, pauses for review, tracks submissions." },
              { t: "Interview Prep", d: "Company research, technical topics, behavioral questions, questions to ask." },
            ].map(f => (
              <div key={f.t} className="bg-white p-5">
                <h3 className="text-[13px] font-medium text-neutral-900">{f.t}</h3>
                <p className="mt-1.5 text-[13px] text-neutral-500 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <p className="text-xs text-neutral-400">JobPilot</p>
        </div>
      </footer>
    </div>
  );
}