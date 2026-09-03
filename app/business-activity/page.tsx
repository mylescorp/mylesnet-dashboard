"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function BusinessActivityPage() {
  const allEvents = useQuery(api.centipid.getRecentAllEvents, { limit: 100 });
  const [filter, setFilter] = useState<"all" | "subscriber" | "payment" | "voucher" | "ticket">("all");

  const filteredEvents = allEvents?.filter((event) => {
    if (filter === "all") return true;
    return event.category === filter;
  });

  const getEventIcon = (category: string) => {
    switch (category) {
      case "subscriber": return "👤";
      case "payment": return "💳";
      case "voucher": return "🎫";
      case "ticket": return "🎫";
      default: return "📋";
    }
  };

  const getEventColor = (category: string) => {
    switch (category) {
      case "subscriber": return "bg-blue-50 border-blue-200";
      case "payment": return "bg-green-50 border-green-200";
      case "voucher": return "bg-purple-50 border-purple-200";
      case "ticket": return "bg-yellow-50 border-yellow-200";
      default: return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Activity Feed</h1>
            <p className="text-sm text-gray-600">Real-time subscriber, payment, voucher, and ticket events from Centipid</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-md ${
                filter === "all"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilter("subscriber")}
              className={`px-4 py-2 rounded-md ${
                filter === "subscriber"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Subscribers
            </button>
            <button
              onClick={() => setFilter("payment")}
              className={`px-4 py-2 rounded-md ${
                filter === "payment"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Payments
            </button>
            <button
              onClick={() => setFilter("voucher")}
              className={`px-4 py-2 rounded-md ${
                filter === "voucher"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Vouchers
            </button>
            <button
              onClick={() => setFilter("ticket")}
              className={`px-4 py-2 rounded-md ${
                filter === "ticket"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Tickets
            </button>
          </div>
        </div>

        {/* Events Feed */}
        {filteredEvents && filteredEvents.length > 0 ? (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <div
                key={event._id}
                className={`border rounded-lg p-4 ${getEventColor(event.category)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{getEventIcon(event.category)}</span>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {event.category} - {event.eventType}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      
                      {/* Event-specific details */}
                      {event.category === "subscriber" && (
                        <div className="mt-2 text-sm">
                          <p><span className="font-medium">Phone:</span> {event.phone}</p>
                          {event.name && <p><span className="font-medium">Name:</span> {event.name}</p>}
                          <p><span className="font-medium">Package:</span> {event.packageName}</p>
                        </div>
                      )}
                      
                      {event.category === "payment" && (
                        <div className="mt-2 text-sm">
                          <p><span className="font-medium">Amount:</span> {event.currency} {event.amount}</p>
                          <p><span className="font-medium">Method:</span> {event.method}</p>
                          <p><span className="font-medium">Subscriber:</span> {event.subscriberPhone}</p>
                        </div>
                      )}
                      
                      {event.category === "voucher" && (
                        <div className="mt-2 text-sm">
                          <p><span className="font-medium">Package:</span> {event.packageName}</p>
                        </div>
                      )}
                      
                      {event.category === "ticket" && (
                        <div className="mt-2 text-sm">
                          <p><span className="font-medium">Subject:</span> {event.subject}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <p className="text-gray-600">
                {filter === "all"
                  ? "No business events recorded yet. Configure Centipid integration to start receiving events."
                  : `No ${filter} events recorded yet.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
