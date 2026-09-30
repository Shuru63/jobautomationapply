"use client";

import { useState, useEffect } from "react";
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
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "", description: "", industry: "", size: "", location: "", websiteUrl: "", careersUrl: "" });

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", ...(search && { search }) });
      const res = await fetch(`/api/companies?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCompanies();
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const addCompany = async () => {
    if (!form.name) return;
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", domain: "", description: "", industry: "", size: "", location: "", websiteUrl: "", careersUrl: "" });
      fetchCompanies();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 mt-1">{companies.length} companies tracked</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 text-sm"
        >
          + Add Company
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input type="url" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Careers Page</label>
              <input type="url" value={form.careersUrl} onChange={(e) => setForm({ ...form, careersUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={addCompany} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 border border-gray-300 rounded-lg outline-none text-sm"
          placeholder="Search companies..."
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-lg">No companies found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-700">{company.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{company.name}</h3>
                  {company.industry && <p className="text-xs text-gray-500">{company.industry}</p>}
                </div>
              </div>
              {company.description && <p className="text-sm text-gray-500 line-clamp-2">{company.description}</p>}
              <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-400">
                {company.location && <span>📍 {company.location}</span>}
                {company.size && <span>👥 {company.size}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}