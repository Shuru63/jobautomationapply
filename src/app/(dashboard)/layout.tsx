"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

type User = { id: string; email: string; fullName: string; role: string; profileId: string | null };

const nav = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Jobs", href: "/jobs" },
  { name: "Applications", href: "/applications" },
  { name: "Resumes", href: "/resumes" },
  { name: "Cover Letters", href: "/cover-letters" },
  { name: "Companies", href: "/companies" },
  { name: "Interviews", href: "/interviews" },
  { name: "Analytics", href: "/analytics" },
  { name: "🚀 Auto-Apply Pipeline", href: "/automation/pipeline" },
  { name: "Automation", href: "/automation" },
  { name: "Profile", href: "/profile" },
  { name: "Settings", href: "/settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) { const d = await res.json(); setUser(d.user); } else { router.push("/login"); }
    } catch { router.push("/login"); } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-700 animate-spin" /></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen flex">
      {open && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-52 bg-white border-r border-neutral-200 flex flex-col transition-transform duration-150 lg:translate-x-0 lg:static lg:z-auto ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-12 flex items-center px-4 border-b border-neutral-100">
          <Link href="/dashboard" className="text-sm font-medium text-neutral-900">JobPilot</Link>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-px overflow-y-auto">
          {nav.map(item => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} onClick={() => setOpen(false)}
                className={`block px-2.5 py-1.5 text-[13px] no-underline ${active ? "text-neutral-900 bg-neutral-100 font-medium" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"}`}>
                {item.name}
              </Link>
            );
          })}
          {user?.role === "admin" && (
            <Link href="/admin" onClick={() => setOpen(false)}
              className={`block px-2.5 py-1.5 text-[13px] no-underline mt-4 border-t border-neutral-100 pt-2 ${pathname.startsWith("/admin") ? "text-purple-700 bg-purple-50 font-bold" : "text-neutral-500 hover:text-purple-700 hover:bg-purple-50"}`}>
              Admin Panel
            </Link>
          )}
        </nav>

        <div className="border-t border-neutral-100 p-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-neutral-200 flex items-center justify-center text-[11px] font-medium text-neutral-600">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-neutral-900 truncate">{user.fullName}</p>
            </div>
            <button onClick={() => { fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }} className="text-neutral-400 hover:text-neutral-700 text-xs">↗</button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 h-12 px-5 flex items-center">
          <button onClick={() => setOpen(true)} className="lg:hidden mr-3 text-neutral-500">☰</button>
          <div className="flex-1" />
          <span className="text-xs text-neutral-400">{user.email}</span>
        </header>
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}