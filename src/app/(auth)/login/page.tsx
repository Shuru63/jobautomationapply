"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); return; }
      router.push("/dashboard");
      router.refresh();
    } catch { setError("An error occurred"); } finally { setLoading(false); }
  };

  return (
    <div className="card p-8">
      <h2 className="text-base font-medium text-neutral-900">Sign in</h2>
      <p className="text-[13px] text-neutral-500 mt-1 mb-6">Enter your credentials.</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-300 text-[13px] text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input" placeholder="you@company.com" />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="input" placeholder="••••••••" />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-neutral-400">
        No account? <Link href="/register" className="text-neutral-900 font-medium hover:underline">Create one</Link>
      </p>
    </div>
  );
}