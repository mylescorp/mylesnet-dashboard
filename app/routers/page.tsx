"use client";

import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

type ConfigDriftResult = {
  success: boolean;
  hasDrift: boolean;
  message: string;
  differences: string[];
  baselineCapturedAt: number | null;
};

export default function RoutersPage() {
  const [showAddRouterModal, setShowAddRouterModal] = useState(false);
  const [showAddAPModal, setShowAddAPModal] = useState(false);
  const [showConfigWatchModal, setShowConfigWatchModal] = useState(false);
  const [selectedRouterForAP, setSelectedRouterForAP] = useState<Id<"routers"> | null>(null);
  const [selectedRouterForBaseline, setSelectedRouterForBaseline] = useState<Id<"routers"> | null>(null);
  const [configDriftResult, setConfigDriftResult] = useState<ConfigDriftResult | null>(null);

  const routers = useQuery(api.routers.listRouters);
  const accessPoints = useQuery(api.accessPoints.listAccessPoints, {});
  const addRouter = useMutation(api.routers.addRouter);
  const deleteRouter = useMutation(api.routers.deleteRouter);
  const addAccessPoint = useMutation(api.accessPoints.addAccessPoint);
  const deleteAccessPoint = useMutation(api.accessPoints.deleteAccessPoint);
  const captureBaseline = useAction(api.configWatch.captureBaseline);
  const checkConfigDrift = useAction(api.configWatch.checkConfigDrift);
  const deleteBaseline = useMutation(api.configWatch.deleteBaseline);
  const baselines = useQuery(
    api.configWatch.getBaselines,
    selectedRouterForBaseline ? { routerId: selectedRouterForBaseline } : "skip"
  );
  const [routerFormData, setRouterFormData] = useState({
    name: "",
    restBaseUrl: "",
    location: "",
    username: "",
    password: "",
    cpuWarningThreshold: 75,
    cpuCriticalThreshold: 90,
  });
  const [apFormData, setApFormData] = useState({
    name: "",
    port: "",
    deviceType: "other" as "cpe220" | "indoor_ap" | "builtin_radio" | "other",
    sharesPortWith: "",
    capacity: "",
    rateLimitReference: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const copyCollectorRouterId = async (routerId: Id<"routers">) => {
    try {
      await navigator.clipboard.writeText(routerId);
      setFeedback("Collector router identifier copied. Add it to the local collector configuration before running the connection check.");
    } catch {
      setFeedback("We could not copy the collector router identifier. Select and copy it manually.");
    }
  };

  const handleRouterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await addRouter({
        name: routerFormData.name,
        restBaseUrl: routerFormData.restBaseUrl,
        location: routerFormData.location,
        username: routerFormData.username,
        password: routerFormData.password,
        cpuWarningThreshold: routerFormData.cpuWarningThreshold,
        cpuCriticalThreshold: routerFormData.cpuCriticalThreshold,
      });

      setShowAddRouterModal(false);
      setRouterFormData({
        name: "",
        restBaseUrl: "",
        location: "",
        username: "",
        password: "",
        cpuWarningThreshold: 75,
        cpuCriticalThreshold: 90,
      });
    } catch {
      setError("Failed to add router. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  const handleAPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouterForAP) return;

    setLoading(true);
    setError("");

    try {
      const apData: {
        routerId: Id<"routers">;
        name: string;
        port: string;
        deviceType: "cpe220" | "indoor_ap" | "builtin_radio" | "other";
        sharesPortWith?: string;
        capacity?: number;
        rateLimitReference?: string;
      } = {
        routerId: selectedRouterForAP,
        name: apFormData.name,
        port: apFormData.port,
        deviceType: apFormData.deviceType,
      };
      
      if (apFormData.sharesPortWith) {
        apData.sharesPortWith = apFormData.sharesPortWith;
      }
      const capacity = Number(apFormData.capacity);
      if (Number.isInteger(capacity) && capacity > 0) apData.capacity = capacity;
      if (apFormData.rateLimitReference.trim()) apData.rateLimitReference = apFormData.rateLimitReference.trim();
      
      await addAccessPoint(apData);

      setShowAddAPModal(false);
      setApFormData({
        name: "",
        port: "",
        deviceType: "other",
        sharesPortWith: "",
        capacity: "",
        rateLimitReference: "",
      });
      setSelectedRouterForAP(null);
    } catch {
      setError("Failed to add access point. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRouter = async (routerId: Id<"routers">) => {
    if (!confirm("Are you sure you want to delete this router?")) return;

    try {
      await deleteRouter({ routerId });
    } catch {
      setFeedback("We could not remove this router. Please try again.");
    }
  };

  const handleDeleteAP = async (apId: Id<"accessPoints">) => {
    if (!confirm("Are you sure you want to delete this access point?")) return;

    try {
      await deleteAccessPoint({ accessPointId: apId });
    } catch {
      setFeedback("We could not remove this access point. Please try again.");
    }
  };

  const handleCaptureBaseline = async (routerId: Id<"routers">) => {
    try {
      const result = await captureBaseline({ routerId });
      setFeedback(result.message);
    } catch {
      setFeedback("We could not capture the router configuration. Check the router connection and try again.");
    }
  };

  const handleCheckConfigDrift = async (routerId: Id<"routers">) => {
    try {
      const result = await checkConfigDrift({ routerId });
      setConfigDriftResult(result);
      setShowConfigWatchModal(true);
      setSelectedRouterForBaseline(routerId);
    } catch {
      setFeedback("We could not check the router configuration. Check the router connection and try again.");
    }
  };

  const handleDeleteBaseline = async (baselineId: Id<"configWatchBaselines">) => {
    if (!confirm("Are you sure you want to delete this baseline?")) return;

    try {
      await deleteBaseline({ baselineId });
    } catch {
      setFeedback("We could not remove this baseline. Please try again.");
    }
  };

  const getAccessPointsForRouter = (routerId: Id<"routers">) => {
    return accessPoints?.filter((ap) => ap.routerId === routerId) || [];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Routers</h1>
            <p className="text-sm text-gray-600">Manage your MikroTik routers and access points</p>
          </div>
          <button
            onClick={() => setShowAddRouterModal(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
          >
            Add Router
          </button>
        </div>

        {feedback ? (
          <p className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {feedback}
          </p>
        ) : null}

        {/* Router List */}
        <div className="space-y-6">
          {routers && routers.length > 0 ? (
            routers.map((router) => (
              <div key={router._id} className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{router.name}</h3>
                      <p className="text-sm text-gray-600">{router.location}</p>
                      <p className="text-xs text-gray-500 mt-1">{router.restBaseUrl}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span>Collector router identifier</span>
                        <code className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-800">{router._id}</code>
                        <button
                          type="button"
                          onClick={() => void copyCollectorRouterId(router._id)}
                          className="font-medium text-orange-700 hover:text-orange-900"
                        >
                          Copy identifier
                        </button>
                      </div>
                      {router.cpuWarningThreshold && (
                        <p className="text-xs text-gray-500 mt-1">
                          CPU Thresholds: Warning {router.cpuWarningThreshold}%, Critical {router.cpuCriticalThreshold}%
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm ${router.hasCredentials ? "text-green-600" : "text-red-600"}`}>
                        {router.hasCredentials ? "✓ Configured" : "✗ Not configured"}
                      </span>
                      <button
                        onClick={() => handleCaptureBaseline(router._id)}
                        className="text-sm text-blue-600 hover:text-blue-900"
                      >
                        Capture Baseline
                      </button>
                      <button
                        onClick={() => handleCheckConfigDrift(router._id)}
                        className="text-sm text-purple-600 hover:text-purple-900"
                      >
                        Check Drift
                      </button>
                      <button
                        onClick={() => handleDeleteRouter(router._id)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Access Points for this router */}
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-medium text-gray-900">Access Points</h4>
                    <button
                      onClick={() => {
                        setSelectedRouterForAP(router._id);
                        setShowAddAPModal(true);
                      }}
                      className="text-sm text-orange-600 hover:text-orange-700"
                    >
                      + Add Access Point
                    </button>
                  </div>

                  {getAccessPointsForRouter(router._id).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getAccessPointsForRouter(router._id).map((ap) => (
                        <div key={ap._id} className="border border-gray-200 rounded-md p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium text-gray-900">{ap.name}</h5>
                              <p className="text-xs text-gray-600">{ap.port}</p>
                              <p className="text-xs text-gray-500 capitalize">{ap.deviceType.replace(/_/g, " ")}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteAP(ap._id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No access points configured</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-600">No routers configured yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Router Modal */}
      {showAddRouterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Router</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleRouterSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Router Name
                </label>
                <input
                  type="text"
                  value={routerFormData.name}
                  onChange={(e) => setRouterFormData({ ...routerFormData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Tayari Router"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={routerFormData.location}
                  onChange={(e) => setRouterFormData({ ...routerFormData, location: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Tayari Market"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  REST Base URL
                </label>
                <input
                  type="url"
                  value={routerFormData.restBaseUrl}
                  onChange={(e) => setRouterFormData({ ...routerFormData, restBaseUrl: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="https://192.168.1.1:8443"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include port (usually 8443 for HTTPS)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RouterOS Username
                </label>
                <input
                  type="text"
                  value={routerFormData.username}
                  onChange={(e) => setRouterFormData({ ...routerFormData, username: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Read-only account username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RouterOS Password
                </label>
                <input
                  type="password"
                  value={routerFormData.password}
                  onChange={(e) => setRouterFormData({ ...routerFormData, password: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Read-only account password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPU Warning Threshold (%)
                </label>
                <input
                  type="number"
                  value={routerFormData.cpuWarningThreshold}
                  onChange={(e) => setRouterFormData({ ...routerFormData, cpuWarningThreshold: Number(e.target.value) })}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="75"
                />
                <p className="text-xs text-gray-500 mt-1">
                  CPU percentage to trigger warning alerts
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPU Critical Threshold (%)
                </label>
                <input
                  type="number"
                  value={routerFormData.cpuCriticalThreshold}
                  onChange={(e) => setRouterFormData({ ...routerFormData, cpuCriticalThreshold: Number(e.target.value) })}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="90"
                />
                <p className="text-xs text-gray-500 mt-1">
                  CPU percentage to trigger critical alerts
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddRouterModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Router"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Access Point Modal */}
      {showAddAPModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Access Point</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleAPSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Point Name
                </label>
                <input
                  type="text"
                  value={apFormData.name}
                  onChange={(e) => setApFormData({ ...apFormData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Main Street AP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port
                </label>
                <input
                  type="text"
                  value={apFormData.port}
                  onChange={(e) => setApFormData({ ...apFormData, port: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., ether2, wlan1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  RouterOS interface name (ether2, ether3, wlan1, etc.)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Type
                </label>
                <select
                  value={apFormData.deviceType}
                  onChange={(e) => setApFormData({ ...apFormData, deviceType: e.target.value as typeof apFormData.deviceType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="cpe220">CPE220</option>
                  <option value="indoor_ap">Indoor AP</option>
                  <option value="builtin_radio">Built-in Radio</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shares Port With (Optional)
                </label>
                <input
                  type="text"
                  value={apFormData.sharesPortWith}
                  onChange={(e) => setApFormData({ ...apFormData, sharesPortWith: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="For daisy-chained devices"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Access point ID if this device shares a port with another
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Safe user capacity (Optional)</label>
                <input type="number" min="1" value={apFormData.capacity} onChange={(e) => setApFormData({ ...apFormData, capacity: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Maximum users for this access point" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate-limit reference (Optional)</label>
                <input type="text" value={apFormData.rateLimitReference} onChange={(e) => setApFormData({ ...apFormData, rateLimitReference: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Configured service rate reference" />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAPModal(false);
                    setSelectedRouterForAP(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Access Point"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Config Watch Modal */}
      {showConfigWatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration Watch</h2>

            {configDriftResult && (
              <div className="space-y-4">
                <div className={`p-4 rounded-md ${
                  configDriftResult.hasDrift ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"
                }`}>
                  <p className={`font-medium ${
                    configDriftResult.hasDrift ? "text-yellow-900" : "text-green-900"
                  }`}>
                    {configDriftResult.message}
                  </p>
                  {configDriftResult.baselineCapturedAt && (
                    <p className="text-sm text-gray-600 mt-1">
                      Baseline captured: {new Date(configDriftResult.baselineCapturedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {configDriftResult.differences && configDriftResult.differences.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Configuration Differences:</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {configDriftResult.differences.map((diff: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-700">{diff}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {baselines && baselines.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Configuration Baselines:</h3>
                    <div className="space-y-2">
                      {baselines.map((baseline) => (
                        <div key={baseline._id} className="border border-gray-200 rounded-md p-3 flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-900">
                              Captured: {new Date(baseline.capturedAt).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(baseline.capturedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteBaseline(baseline._id)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  setShowConfigWatchModal(false);
                  setConfigDriftResult(null);
                  setSelectedRouterForBaseline(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
