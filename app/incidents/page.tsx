"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IncidentsPage() {
  const router = useRouter();
  const incidents = useQuery(api.incidents.listIncidents, {});
  const acknowledgeIncident = useMutation(api.incidents.acknowledgeIncident);
  const resolveIncident = useMutation(api.incidents.resolveIncident);
  const createIncident = useMutation(api.incidents.createIncident);
  const routers = useQuery(api.routers.listRouters);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    routerId: "",
    note: "",
    severity: "warning",
  });
  const [loading, setLoading] = useState(false);

  const handleAcknowledge = async (incidentId: string) => {
    try {
      await acknowledgeIncident({ incidentId: incidentId as any });
    } catch (err) {
      console.error("Failed to acknowledge incident:", err);
    }
  };

  const handleResolve = async (incidentId: string) => {
    try {
      await resolveIncident({ incidentId: incidentId as any });
    } catch (err) {
      console.error("Failed to resolve incident:", err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createIncident({
        routerId: formData.routerId as any,
        note: formData.note,
        severity: formData.severity,
      });

      setShowCreateModal(false);
      setFormData({ routerId: "", note: "", severity: "warning" });
    } catch (err) {
      console.error("Failed to create incident:", err);
    } finally {
      setLoading(false);
    }
  };

  const openIncidents = incidents?.filter((i) => !i.resolvedAt) || [];
  const resolvedIncidents = incidents?.filter((i) => i.resolvedAt) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
              <p className="text-sm text-gray-600">Track and resolve network incidents</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
              >
                Create Incident
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-gray-600 hover:text-gray-900"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Open Incidents */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Open Incidents ({openIncidents.length})
          </h2>
          <div className="space-y-4">
            {openIncidents.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
                No open incidents
              </div>
            ) : (
              openIncidents.map((incident) => (
                <div
                  key={incident._id}
                  className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                    incident.severity === "critical" ? "border-red-500" : "border-yellow-500"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{incident.note}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Opened: {new Date(incident.openedAt).toLocaleString()}
                      </p>
                      {incident.acknowledgedBy && (
                        <p className="text-sm text-gray-600">
                          Acknowledged by: {incident.acknowledgedBy}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcknowledge(incident._id)}
                        className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => handleResolve(incident._id)}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-md hover:bg-green-200"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resolved Incidents */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Resolved Incidents ({resolvedIncidents.length})
          </h2>
          <div className="space-y-4">
            {resolvedIncidents.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
                No resolved incidents
              </div>
            ) : (
              resolvedIncidents.map((incident) => (
                <div
                  key={incident._id}
                  className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500 opacity-75"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{incident.note}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Opened: {new Date(incident.openedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Resolved: {new Date(incident.resolvedAt!).toLocaleString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-md">
                      Resolved
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Incident</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Router
                </label>
                <select
                  value={formData.routerId}
                  onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a router</option>
                  {routers?.map((router) => (
                    <option key={router._id} value={router._id}>
                      {router.name} ({router.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Describe the incident..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Incident"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
