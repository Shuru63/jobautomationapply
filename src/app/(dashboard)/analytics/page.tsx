"use client";

import { useState, useEffect } from "react";

type Analytics = {
  statusCounts: Array<{ status: string; count: number }>;
  matchDistribution: Array<{ rating: string; count: number }>;
  sourceDistribution: Array<{ source: string; count: number }>;
  topRoles: Array<{ title: string; count: number }>;
  resumePerformance: Array<{ template: string; count: number }>;
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-200 rounded-xl" />)}</div>;

  const totalApps = analytics?.statusCounts.reduce((a, b) => a + Number(b.count), 0) || 0;

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-400";
      case "pending_review": return "bg-yellow-400";
      case "approved": return "bg-blue-400";
      case "submitted": return "bg-indigo-400";
      case "viewed": return "bg-purple-400";
      case "interview": return "bg-green-400";
      case "offer": return "bg-emerald-400";
      case "rejected": return "bg-red-400";
      default: return "bg-gray-300";
    }
  };

  const ratingColor = (rating: string) => {
    switch (rating) {
      case "excellent": return "bg-emerald-400";
      case "strong": return "bg-green-400";
      case "good": return "bg-blue-400";
      case "fair": return "bg-yellow-400";
      case "weak": return "bg-orange-400";
      case "poor": return "bg-red-400";
      default: return "bg-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Job search performance overview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Application Status</h3>
          {analytics?.statusCounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {analytics?.statusCounts.map((item) => (
                <div key={item.status} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-600 capitalize truncate">{item.status.replace("_", " ")}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${statusColor(item.status)} transition-all duration-500`}
                      style={{ width: `${totalApps > 0 ? (Number(item.count) / totalApps) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-sm font-semibold text-gray-700">{String(item.count)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Job Match Ratings</h3>
          {analytics?.matchDistribution.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {analytics?.matchDistribution.map((item) => {
                const total = analytics.matchDistribution.reduce((a, b) => a + Number(b.count), 0);
                return (
                  <div key={item.rating} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-gray-600 capitalize">{item.rating}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ratingColor(item.rating)} transition-all duration-500`}
                        style={{ width: `${total > 0 ? (Number(item.count) / total) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-sm font-semibold text-gray-700">{String(item.count)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Job Sources */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Job Sources</h3>
          {analytics?.sourceDistribution.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {analytics?.sourceDistribution.map((item) => (
                <div key={item.source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700 capitalize">{item.source.replace("_", " ")}</span>
                  <span className="text-sm font-bold text-gray-900">{String(item.count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Roles */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top Matched Roles</h3>
          {analytics?.topRoles.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-2">
              {analytics?.topRoles.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-700 truncate">{item.title}</span>
                  <span className="text-sm font-bold text-gray-900">{String(item.count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resume Stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Resumes Generated</h3>
          {analytics?.resumePerformance.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No resumes generated yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {analytics?.resumePerformance.map((item) => (
                <div key={item.template} className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{String(item.count)}</p>
                  <p className="text-xs text-gray-500 capitalize mt-1">{item.template.replace("_", " ")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}