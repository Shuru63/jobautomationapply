"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, fullName }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      router.push("/dashboard");
      router.refresh();
    } catch { setError("An error occurred"); } finally { setLoading(false); }
  };

  return (
    <div className="card p-8">
      <h2 className="text-base font-medium text-neutral-900">Create account</h2>
      <p className="text-[13px] text-neutral-500 mt-1 mb-6">Start automating your job search.</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-300 text-[13px] text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="input" placeholder="John Doe" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input" placeholder="you@company.com" />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="input" placeholder="8+ characters" />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="input" placeholder="••••••••" />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-neutral-400">
        Have an account? <Link href="/login" className="text-neutral-900 font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}