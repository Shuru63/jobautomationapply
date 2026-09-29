"use client";

import { useState, useEffect } from "react";

type CoverLetter = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  job: { id: string; title: string; company: { name: string } | null } | null;
};

export default function CoverLettersPage() {
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCL, setSelectedCL] = useState<CoverLetter | null>(null);

  useEffect(() => {
    async function fetchCL() {
      try {
        const res = await fetch("/api/cover-letters");
        if (res.ok) {
          const data = await res.json();
          setCoverLetters(data.coverLetters);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCL();
  }, []);

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-200 rounded-xl"></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cover Letters</h1>
        <p className="text-gray-500 mt-1">{coverLetters.length} cover letters</p>
      </div>

      {coverLetters.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-700">No cover letters yet</h3>
          <p className="text-sm text-gray-500 mt-1">Generate cover letters from job applications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coverLetters.map((cl) => (
            <div
              key={cl.id}
              onClick={() => setSelectedCL(cl)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{cl.title || "Cover Letter"}</h3>
                  {cl.job && (
                    <p className="text-sm text-gray-600 mt-0.5">
                      For: {cl.job.title} at {cl.job.company?.name || "Unknown"}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{new Date(cl.createdAt).toLocaleDateString()}</p>
                </div>
                <button className="text-primary-600 text-sm hover:underline">View</button>
              </div>
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">{cl.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cover Letter Preview Modal */}
      {selectedCL && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCL(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedCL.title || "Cover Letter"}</h2>
                {selectedCL.job && (
                  <p className="text-sm text-gray-600">
                    {selectedCL.job.title} at {selectedCL.job.company?.name || "Unknown"}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedCL(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {selectedCL.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}