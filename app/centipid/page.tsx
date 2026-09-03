"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function CentipidSettingsPage() {
  const integration = useQuery(api.centipid.getCentipidIntegrationStatus, {});
  const deliveryLogs = useQuery(api.centipid.getWebhookDeliveryLogs, { limit: 20 });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Business integration</h1>
        {integration === undefined ? (
          <p className="mt-3 text-sm text-slate-600">Loading integration status.</p>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            {integration.available
              ? "The business event connection is active."
              : "The provider connection is unavailable until its authenticated API and webhook contract are confirmed."}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Webhook deliveries</h2>
        {deliveryLogs === undefined ? (
          <p className="mt-3 text-sm text-slate-600">Loading delivery records.</p>
        ) : deliveryLogs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No verified deliveries have been recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {deliveryLogs.map((delivery) => (
              <li key={delivery._id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium text-slate-900">{delivery.eventType}</span>
                <span className="text-slate-600">
                  {new Date(delivery.receivedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
