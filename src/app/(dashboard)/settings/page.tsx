"use client";

import { useState, useEffect } from "react";

type Source = {
  id: string;
  name: string;
  type: string;
  url: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunJobCount: number | null;
  createdAt: string;
};

export default function SettingsPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    name: "",
    type: "greenhouse",
    url: "",
    config: "{}",
  });

  useEffect(() => {
    async function fetchSources() {
      try {
        const res = await fetch("/api/job-sources");
        if (res.ok) {
          const data = await res.json();
          setSources(data.sources);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSources();
  }, []);

  const addSource = async () => {
    if (!sourceForm.name || !sourceForm.url) return;
    try {
      const config = JSON.parse(sourceForm.config || "{}");
      const res = await fetch("/api/job-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sourceForm, config }),
      });
      if (res.ok) {
        setShowAddSource(false);
        setSourceForm({ name: "", type: "greenhouse", url: "", config: "{}" });
        const refreshRes = await fetch("/api/job-sources");
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setSources(data.sources);
        }
      }
    } catch {
      alert("Invalid JSON config");
    }
  };

  const sourceTypeIcon = (type: string) => {
    switch (type) {
      case "greenhouse": return "🌱";
      case "lever": return "⚡";
      case "ashby": return "🏢";
      case "workday": return "💼";
      case "api": return "🔌";
      case "career_page": return "🌐";
      case "manual": return "✍️";
      default: return "📋";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your job search automation</p>
      </div>

      {/* AI Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">🤖 AI Providers</h3>
        <p className="text-sm text-gray-500 mb-4">
          The AI Router automatically selects the best provider for each task. Configure at least one provider.
        </p>
        <div className="space-y-3">
          {[
            { name: "Gemini (Google)", env: "GEMINI_API_KEY", role: "Primary for CV parsing, fast tasks", color: "blue" },
            { name: "Groq", env: "GROQ_API_KEY", role: "Fast processing, classification, normalization", color: "green" },
            { name: "OpenRouter", env: "OPENROUTER_API_KEY", role: "Fallback, access to multiple models", color: "orange" },
            { name: "Ollama (Local)", env: "OLLAMA_BASE_URL", role: "Local/private inference, no API key needed", color: "gray" },
          ].map((provider) => (
            <div key={provider.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                <p className="text-xs text-gray-500">{provider.role}</p>
                <p className="text-xs text-gray-400 mt-0.5">Env: <code className="bg-gray-100 px-1 rounded">{provider.env}</code></p>
              </div>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full bg-${provider.color}-100 text-${provider.color}-700`}>
                Available
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>AI Router:</strong> CV parsing → Gemini → OpenRouter. Fast tasks → Groq → Gemini → Ollama.
            The router automatically falls back to the next provider if one fails.
          </p>
        </div>
      </div>

      {/* Job Sources */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">📡 Job Sources</h3>
          <button
            onClick={() => setShowAddSource(!showAddSource)}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
          >
            + Add Source
          </button>
        </div>

        {showAddSource && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={sourceForm.name}
                  onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm"
                  placeholder="e.g., Greenhouse - Company X"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={sourceForm.type}
                  onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm"
                >
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="ashby">Ashby</option>
                  <option value="workday">Workday</option>
                  <option value="career_page">Career Page</option>
                  <option value="api">API</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  value={sourceForm.url}
                  onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm"
                  placeholder="https://boards.greenhouse.io/company"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addSource} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Save</button>
              <button onClick={() => setShowAddSource(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : sources.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No job sources configured</p>
            <p className="text-xs mt-1">Add Greenhouse, Lever, or career page sources to auto-discover jobs</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <span className="text-2xl">{sourceTypeIcon(source.type)}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{source.name}</p>
                  <p className="text-xs text-gray-500">{source.url}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${source.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {source.isActive ? "Active" : "Inactive"}
                  </span>
                  {source.lastRunJobCount !== null && (
                    <p className="text-xs text-gray-400 mt-1">{source.lastRunJobCount} jobs last run</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Database */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">💾 Database</h3>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-sm font-medium text-gray-900">PostgreSQL Connected</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Drizzle ORM with PostgreSQL</p>
        </div>
      </div>

      {/* Controlled Auto-Apply */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">🤖 Auto-Apply Configuration</h3>
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <p className="text-sm font-medium text-green-900">Controlled Auto-Apply is Available</p>
            </div>
            <p className="text-xs text-green-700">
              When enabled, the system will automatically fill applications, generate tailored resumes, and submit to jobs matching your configured criteria. All submissions require your approval in Assisted mode.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-900">🔍 Auto Job Search</p>
              <p className="text-xs text-gray-500 mt-1">Scans career pages on schedule</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-900">📄 Auto Resume</p>
              <p className="text-xs text-gray-500 mt-1">Generates tailored resume per job</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-900">📝 Auto Application</p>
              <p className="text-xs text-gray-500 mt-1">Fills forms with Playwright</p>
            </div>
          </div>
        </div>
      </div>

      {/* Browser Automation */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">🌐 Browser Automation</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Playwright Chromium</p>
              <p className="text-xs text-gray-500">For career page scraping and form filling</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Installed</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">CAPTCHA Detection</p>
              <p className="text-xs text-gray-500">Pauses automation and notifies you</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">MFA Detection</p>
              <p className="text-xs text-gray-500">Stops and waits for manual intervention</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
          </div>
        </div>
      </div>

      {/* Background Workers */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">⚡ Background Workers</h3>
        <div className="space-y-3">
          {[
            { name: "Job Search Worker", desc: "Scans career pages, normalizes jobs" },
            { name: "Resume Worker", desc: "Generates AI-tailored resumes" },
            { name: "Application Worker", desc: "Fills forms via Playwright" },
            { name: "Email Monitor", desc: "Classifies incoming job emails" },
            { name: "Interview Prep", desc: "Generates preparation materials" },
          ].map((worker) => (
            <div key={worker.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{worker.name}</p>
                <p className="text-xs text-gray-500">{worker.desc}</p>
              </div>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">BullMQ + Redis</span>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> Workers run as a separate process via <code className="bg-amber-100 px-1 rounded">npx tsx src/workers/start.ts</code> or via the <code className="bg-amber-100 px-1 rounded">docker-compose.yml</code> workers service. Install Redis to enable background processing.
          </p>
        </div>
      </div>

      {/* Architecture Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">🏗️ Architecture</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[
            { label: "Next.js 16", desc: "App Router" },
            { label: "Drizzle ORM", desc: "PostgreSQL" },
            { label: "Gemini AI", desc: "2.0 Flash" },
            { label: "BullMQ", desc: "Background Jobs" },
            { label: "Playwright", desc: "Browser Automation" },
            { label: "Redis", desc: "Queue Backend" },
            { label: "Sentry", desc: "Error Tracking" },
            { label: "Docker", desc: "Deployment" },
          ].map((tech) => (
            <div key={tech.label} className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{tech.label}</p>
              <p className="text-xs text-gray-500">{tech.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}