"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export default function UsagePage() {
  const routers = useQuery(api.routers.listRouters, {});
  const [selectedRouter, setSelectedRouter] = useState<string | null>(null);
  const selectedRouterRecord = routers?.find((router) => router._id === selectedRouter);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");

  const usageReport = useQuery(
    api.usage.getUsageReport,
    selectedRouterRecord
      ? { routerId: selectedRouterRecord._id, period }
      : "skip"
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const exportCSV = () => {
    if (!usageReport) return;

    const headers = ["Subscriber", "Total Bytes", "Sample Count"];
    const rows = usageReport.bySubscriber.map((item) => [
      item.subscriber,
      item.totalBytes.toString(),
      item.sampleCount.toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-report-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--surface-muted)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-strong)]">Usage Reports</h1>
            <p className="text-sm text-[var(--muted)]">Network usage statistics and reports</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[var(--surface)] rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Router
              </label>
              <select
                value={selectedRouter || ""}
                onChange={(e) => setSelectedRouter(e.target.value || null)}
                className="w-full px-3 py-2 border border-[var(--line)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="">All Routers</option>
                {routers?.map((router) => (
                  <option key={router._id} value={router._id}>
                    {router.name} ({router.location})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as "day" | "week" | "month")}
                className="w-full px-3 py-2 border border-[var(--line)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={exportCSV}
                disabled={!usageReport}
                className="w-full bg-[var(--success)] text-[var(--primary-action-foreground)] px-4 py-2 rounded-md hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Usage Report */}
        {usageReport ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[var(--surface)] rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-[var(--muted)]">Total Data Transfer</h3>
                <p className="text-3xl font-bold text-[var(--text-strong)] mt-2">
                  {formatBytes(usageReport.totalBytes)}
                </p>
              </div>
              <div className="bg-[var(--surface)] rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-[var(--muted)]">Total Samples</h3>
                <p className="text-3xl font-bold text-[var(--text-strong)] mt-2">
                  {usageReport.totalSamples}
                </p>
              </div>
              <div className="bg-[var(--surface)] rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-[var(--muted)]">Unique Subscribers</h3>
                <p className="text-3xl font-bold text-[var(--text-strong)] mt-2">
                  {usageReport.bySubscriber.length}
                </p>
              </div>
            </div>

            {/* Usage Table */}
            <div className="bg-[var(--surface)] rounded-lg shadow">
              <div className="p-6 border-b border-[var(--line)]">
                <h3 className="text-lg font-semibold text-[var(--text-strong)]">
                  Usage by Subscriber
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--line)]">
                  <thead className="bg-[var(--surface-muted)]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                        Subscriber
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                        Total Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                        Sample Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--surface)] divide-y divide-[var(--line)]">
                    {usageReport.bySubscriber.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-[var(--muted)]">
                          No usage data for this period
                        </td>
                      </tr>
                    ) : (
                      usageReport.bySubscriber.map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-strong)]">
                            {item.subscriber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted)]">
                            {formatBytes(item.totalBytes)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted)]">
                            {item.sampleCount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--surface)] rounded-lg shadow p-6">
            <div className="text-center py-12">
              <p className="text-[var(--muted)]">
                {selectedRouter
                  ? "Loading usage data..."
                  : "Select a router to view usage reports"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}