"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-secondary)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-[15px] font-medium text-[var(--color-text-primary)] tracking-tight no-underline">
            JobPilot
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}