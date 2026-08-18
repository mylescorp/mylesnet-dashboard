"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function RoutersPage() {
  const routers = useQuery(api.routers.listRouters);
  const accessPoints = useQuery(api.accessPoints.listAccessPoints, {});
  const addRouter = useMutation(api.routers.addRouter);
  const deleteRouter = useMutation(api.routers.deleteRouter);
  const addAccessPoint = useMutation(api.accessPoints.addAccessPoint);
  const deleteAccessPoint = useMutation(api.accessPoints.deleteAccessPoint);

  const [showAddRouterModal, setShowAddRouterModal] = useState(false);
  const [showAddAPModal, setShowAddAPModal] = useState(false);
  const [selectedRouterForAP, setSelectedRouterForAP] = useState<string | null>(null);
  const [routerFormData, setRouterFormData] = useState({
    name: "",
    restBaseUrl: "",
    location: "",
    username: "",
    password: "",
  });
  const [apFormData, setApFormData] = useState({
    name: "",
    port: "",
    deviceType: "other" as "cpe220" | "indoor_ap" | "builtin_radio" | "other",
    sharesPortWith: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      });

      setShowAddRouterModal(false);
      setRouterFormData({
        name: "",
        restBaseUrl: "",
        location: "",
        username: "",
        password: "",
      });
    } catch (err) {
      setError("Failed to add router. Please check your inputs.");
      console.error(err);
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
      const apData: any = {
        routerId: selectedRouterForAP as any,
        name: apFormData.name,
        port: apFormData.port,
        deviceType: apFormData.deviceType,
      };
      
      if (apFormData.sharesPortWith) {
        apData.sharesPortWith = apFormData.sharesPortWith;
      }
      
      await addAccessPoint(apData);

      setShowAddAPModal(false);
      setApFormData({
        name: "",
        port: "",
        deviceType: "other",
        sharesPortWith: "",
      });
      setSelectedRouterForAP(null);
    } catch (err) {
      setError("Failed to add access point. Please check your inputs.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRouter = async (routerId: string) => {
    if (!confirm("Are you sure you want to delete this router?")) return;

    try {
      await deleteRouter({ routerId: routerId as any });
    } catch (err) {
      console.error("Failed to delete router:", err);
    }
  };

  const handleDeleteAP = async (apId: string) => {
    if (!confirm("Are you sure you want to delete this access point?")) return;

    try {
      await deleteAccessPoint({ accessPointId: apId as any });
    } catch (err) {
      console.error("Failed to delete access point:", err);
    }
  };

  const getAccessPointsForRouter = (routerId: string) => {
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
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm ${router.hasCredentials ? "text-green-600" : "text-red-600"}`}>
                        {router.hasCredentials ? "✓ Configured" : "✗ Not configured"}
                      </span>
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
                  onChange={(e) => setApFormData({ ...apFormData, deviceType: e.target.value as any })}
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
    </div>
  );
}
