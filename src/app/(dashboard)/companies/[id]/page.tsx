"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  domain: string | null;
  description: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  websiteUrl: string | null;
  careersUrl: string | null;
  notes: string | null;
  jobs: Array<{
    id: string;
    title: string;
    location: string | null;
    remoteType: string | null;
    createdAt: string;
  }>;
};

export default function CompanyDetailPage() {
  const params = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setCompany(data.company);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  if (loading) return <div className="animate-pulse h-64 bg-gray-200 rounded-xl"></div>;
  if (!company) return <div className="text-center py-12"><h2 className="text-xl text-gray-700">Company not found</h2></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/companies" className="hover:text-primary-600">Companies</Link>
        <span>/</span>
        <span className="text-gray-900">{company.name}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-700">{company.name.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              {company.industry && <span>{company.industry}</span>}
              {company.size && <span>· {company.size}</span>}
              {company.location && <span>· {company.location}</span>}
            </div>
            {company.description && <p className="text-gray-600 mt-3">{company.description}</p>}
            <div className="flex gap-3 mt-4">
              {company.websiteUrl && (
                <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-primary-50 text-primary-700 text-sm rounded-lg hover:bg-primary-100">Website ↗</a>
              )}
              {company.careersUrl && (
                <a href={company.careersUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg hover:bg-green-100">Careers ↗</a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs at {company.name}</h3>
        {company.jobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No jobs found</div>
        ) : (
          <div className="space-y-3">
            {company.jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 transition-colors">
                <h4 className="font-semibold text-gray-900">{job.title}</h4>
                <p className="text-sm text-gray-500 mt-0.5">
                  {job.location || "Location not specified"}
                  {job.remoteType === "remote" && " · Remote"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}