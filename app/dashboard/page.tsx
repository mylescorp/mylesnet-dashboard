"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const [selectedRouter, setSelectedRouter] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Simplified auth check for now
    setIsAuthenticated(true);
  }, []);

  const dashboardSummary = useQuery(api.dashboard.getDashboardSummary);
  const routerDashboard = useQuery(api.dashboard.getRouterDashboard, {
    routerId: selectedRouter as any,
  });
  const recentIncidents = useQuery(api.dashboard.getRecentIncidents, { limit: 5 });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600">Network Operations Center</p>
          </div>
          <div className="flex items-center gap-4">
            {recentIncidents && recentIncidents.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md">
                {recentIncidents.length} Open Incident{recentIncidents.length !== 1 ? "s" : ""}
              </div>
            )}
            <button
              onClick={() => router.push("/routers")}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
            >
              Add Router
            </button>
          </div>
        </div>

        {/* Alert Banner for Open Incidents */}
        {recentIncidents && recentIncidents.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="font-semibold text-red-900 mb-2">Active Incidents</h3>
            <div className="space-y-2">
              {recentIncidents.map((incident: any) => (
                <div key={incident._id} className="text-sm text-red-800">
                  <span className="font-medium">{incident.note}</span>
                  <span className="ml-2">({new Date(incident.openedAt).toLocaleString()})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Router Selection */}
        {dashboardSummary && dashboardSummary.totalRouters > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Router
            </label>
            <select
              value={selectedRouter || ""}
              onChange={(e) => setSelectedRouter(e.target.value || null)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Routers</option>
              {routerDashboard && routerDashboard.map((data: any) => (
                <option key={data.router._id} value={data.router._id}>
                  {data.router.name} ({data.router.location})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Routers</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {dashboardSummary?.totalRouters || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Open Incidents</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {dashboardSummary?.openIncidents || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">System Status</h3>
            <p className={`text-3xl font-bold mt-2 ${
              dashboardSummary?.systemStatus === "healthy" ? "text-green-600" : "text-yellow-600"
            }`}>
              {dashboardSummary?.systemStatus === "healthy" ? "Healthy" : "Warning"}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Configured Routers</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {dashboardSummary?.configuredRouters || 0}
            </p>
          </div>
        </div>

        {/* Router Health Data */}
        {routerDashboard && routerDashboard.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Router Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {routerDashboard.map((data: any) => (
                <div key={data.router._id} className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {data.router.name} ({data.router.location})
                  </h3>
                  {data.health ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">CPU</span>
                        <span className="text-sm font-medium">{data.health.cpuPercent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Memory</span>
                        <span className="text-sm font-medium">{data.health.memoryPercent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Status</span>
                        <span className={`text-sm font-medium ${
                          data.health.linkState ? "text-green-600" : "text-red-600"
                        }`}>
                          {data.health.linkState ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No health data available</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Access Point Health */}
        {routerDashboard && routerDashboard.length > 0 && routerDashboard.some((data: any) => data.accessPoints.length > 0) && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Access Points</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {routerDashboard.map((data: any) =>
                data.accessPoints.map((apData: any) => (
                  <div key={apData.accessPoint._id} className="bg-white rounded-lg shadow p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{apData.accessPoint.name}</h4>
                    <p className="text-xs text-gray-600 mb-2">{apData.accessPoint.port}</p>
                    {apData.health ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Status</span>
                          <span className={`font-medium ${
                            apData.health.linkState ? "text-green-600" : "text-red-600"
                          }`}>
                            {apData.health.linkState ? "Online" : "Offline"}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Errors</span>
                          <span className="font-medium">{apData.health.errorCount}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Drops</span>
                          <span className="font-medium">{apData.health.queueDrops}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No data</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => router.push("/incidents")}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">Incidents</h3>
            <p className="text-sm text-gray-600 mt-2">View and manage incidents</p>
          </button>
          <button
            onClick={() => router.push("/shift-notes")}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">Shift Notes</h3>
            <p className="text-sm text-gray-600 mt-2">View operator notes</p>
          </button>
          <button
            onClick={() => router.push("/usage")}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">Usage Reports</h3>
            <p className="text-sm text-gray-600 mt-2">View usage statistics</p>
          </button>
        </div>

        {/* No Routers State */}
        {dashboardSummary && dashboardSummary.totalRouters === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No routers configured</h3>
            <p className="text-gray-600 mb-4">Add your first router to get started</p>
            <button
              onClick={() => router.push("/routers")}
              className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700"
            >
              Add Router
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
