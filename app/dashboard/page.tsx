"use client";

import { useQuery, useMutation } from "convex/react";
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

  const routers = useQuery(api.routers.listRouters);
  const openIncidents = useQuery(api.incidents.getOpenIncidents);
  const latestHealth = useQuery(
    api.usage.getLatestHealth,
    selectedRouter ? { routerId: selectedRouter as any } : "skip"
  );
  const accessPointHealth = useQuery(
    api.usage.getAccessPointHealth,
    selectedRouter ? { routerId: selectedRouter as any } : "skip"
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">MylesNet Dashboard</h1>
              <p className="text-sm text-gray-600">Network Operations Center</p>
            </div>
            <div className="flex items-center gap-4">
              {openIncidents && openIncidents.length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md">
                  {openIncidents.length} Open Incident{openIncidents.length !== 1 ? "s" : ""}
                </div>
              )}
              <button
                onClick={() => router.push("/routers")}
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
              >
                Manage Routers
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Router Selection */}
        {routers && routers.length > 0 && (
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
              {routers.map((router) => (
                <option key={router._id} value={router._id}>
                  {router.name} ({router.location})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Health Metrics */}
        {selectedRouter && latestHealth && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600">CPU Usage</h3>
              <p className={`text-3xl font-bold mt-2 ${latestHealth.cpuPercent > 90 ? 'text-red-600' : latestHealth.cpuPercent > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                {latestHealth.cpuPercent.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600">Memory Usage</h3>
              <p className={`text-3xl font-bold mt-2 ${latestHealth.memoryPercent > 90 ? 'text-red-600' : latestHealth.memoryPercent > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                {latestHealth.memoryPercent.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600">Link State</h3>
              <p className={`text-3xl font-bold mt-2 ${latestHealth.linkState ? 'text-green-600' : 'text-red-600'}`}>
                {latestHealth.linkState ? 'Up' : 'Down'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600">Error Count</h3>
              <p className={`text-3xl font-bold mt-2 ${latestHealth.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {latestHealth.errorCount}
              </p>
            </div>
          </div>
        )}

        {/* Access Point Health */}
        {selectedRouter && accessPointHealth && accessPointHealth.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Access Point Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {accessPointHealth.map((health) => (
                <div key={health.accessPoint._id} className={`bg-white rounded-lg shadow p-4 ${!health.linkState ? 'border-2 border-red-500' : ''}`}>
                  <h3 className="font-medium text-gray-900">{health.accessPoint.name}</h3>
                  <p className="text-sm text-gray-600">{health.accessPoint.port}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Link:</span>
                      <span className={health.linkState ? 'text-green-600' : 'text-red-600'}>
                        {health.linkState ? 'Up' : 'Down'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Errors:</span>
                      <span className={health.errorCount > 0 ? 'text-red-600' : 'text-green-600'}>
                        {health.errorCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Routers</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {routers?.length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Open Incidents</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {openIncidents?.length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">System Status</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {openIncidents && openIncidents.length === 0 ? "Healthy" : "Warning"}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Configured Routers</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {routers?.filter((r) => r.hasCredentials).length || 0}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => router.push("/incidents")}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Incidents</h3>
            <p className="text-sm text-gray-600 mt-2">View and manage incidents</p>
          </button>
          <button
            onClick={() => router.push("/shift-notes")}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Shift Notes</h3>
            <p className="text-sm text-gray-600 mt-2">View operator notes</p>
          </button>
          <button
            onClick={() => router.push("/usage")}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Usage Reports</h3>
            <p className="text-sm text-gray-600 mt-2">View usage statistics</p>
          </button>
        </div>

        {/* No Routers State */}
        {routers && routers.length === 0 && (
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
      </main>
    </div>
  );
}
