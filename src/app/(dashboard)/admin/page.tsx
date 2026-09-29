"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type UserData = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  activity: {
    applications: number;
    resumes: number;
    aiGenerations: number;
  };
};

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = async (page = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=10&search=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        if (res.status === 401) setError("Unauthorized. You must be an admin to view this page.");
        else setError("Failed to fetch users.");
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
      setTelemetry(data.telemetry);
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, "");
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1, search);
  };

  const updateUserAction = async (userId: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        fetchUsers(pagination.page, search);
      } else {
        alert("Failed to update user.");
      }
    } catch {
      alert("Error updating user.");
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-8 rounded-2xl max-w-lg w-full">
          <h2 className="text-xl font-bold mb-3">Access Denied</h2>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 drop-shadow-sm">Admin Control Panel</h1>
          <p className="text-neutral-500 mt-2 text-sm max-w-xl">Monitor platform users, track their activities, and manage access.</p>
        </div>
      </div>

      {telemetry && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-neutral-500">Total Users</span>
            <span className="text-3xl font-bold text-neutral-900 mt-2">{pagination.total}</span>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-neutral-500">Total AI Tokens Used</span>
            <span className="text-3xl font-bold text-indigo-600 mt-2">
              {((telemetry.tokens.input + telemetry.tokens.output) / 1000).toFixed(1)}k
            </span>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-neutral-500">Active Background Workers</span>
            <span className="text-3xl font-bold text-emerald-600 mt-2">
              {telemetry.workers.filter((w: any) => w.status === 'running').reduce((acc: number, w: any) => acc + w.count, 0)}
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border border-neutral-200/60 rounded-2xl shadow-xl shadow-black/[0.03] overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-neutral-50/50">
          <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Search users..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
            />
            <button type="submit" className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors">Search</button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50/80 border-b border-neutral-200/80 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 font-semibold text-neutral-600">User Details</th>
                <th className="px-6 py-4 font-semibold text-neutral-600">Status & Role</th>
                <th className="px-6 py-4 font-semibold text-neutral-600">Timestamps</th>
                <th className="px-6 py-4 font-semibold text-neutral-600 text-center">Activity</th>
                <th className="px-6 py-4 font-semibold text-neutral-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-neutral-500">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-neutral-500">No users found.</td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.id} className="group hover:bg-neutral-50/50 transition-colors duration-200">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-neutral-900">{u.fullName}</span>
                        <span className="text-neutral-500 text-xs mt-0.5">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col items-start gap-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>{u.role}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{u.isActive ? 'Active' : 'Suspended'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-neutral-500 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                      <span>Login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-neutral-700">
                      <span title="Applications" className="px-2 py-1 bg-neutral-100 rounded">Apps: {u.activity.applications}</span>
                      <span title="Resumes" className="px-2 py-1 bg-neutral-100 rounded">Res: {u.activity.resumes}</span>
                      <span title="AI Generations" className="px-2 py-1 bg-neutral-100 rounded">AI: {u.activity.aiGenerations}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      {u.isActive ? (
                        <button onClick={() => updateUserAction(u.id, "suspend")} className="text-xs px-3 py-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 font-medium">Suspend</button>
                      ) : (
                        <button onClick={() => updateUserAction(u.id, "activate")} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-medium">Activate</button>
                      )}
                      
                      {u.role === 'candidate' ? (
                        <button onClick={() => updateUserAction(u.id, "promote")} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 font-medium">Promote</button>
                      ) : (
                        <button onClick={() => updateUserAction(u.id, "demote")} className="text-xs px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded hover:bg-neutral-200 font-medium">Demote</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-neutral-200 flex justify-between items-center bg-white text-sm text-neutral-500">
          <span>Showing page {pagination.page} of {pagination.totalPages || 1}</span>
          <div className="flex gap-2">
            <button 
              disabled={pagination.page <= 1}
              onClick={() => fetchUsers(pagination.page - 1)}
              className="px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button 
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchUsers(pagination.page + 1)}
              className="px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
