"use client";

import { userFacingMessage } from "@/shared/lib/user-facing-error";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@mylesnet/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

export default function NewSubscriberPage() {
  const router = useRouter();
  const createSubscriber = useMutation(api.subscribers.create);
  const plans = useQuery(api.plans.listPlans, {});

  const [formData, setFormData] = useState({
    accountNumber: "",
    name: "",
    phone: "",
    email: "",
    username: "",
    planId: "",
    connectionType: "pppoe" as "pppoe" | "hotspot",
    macAddress: "",
    currency: "KES",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const subscriberId = await createSubscriber({
        accountNumber: formData.accountNumber,
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        username: formData.username || undefined,
        planId: formData.planId ? (formData.planId as Id<"plans">) : undefined,
        connectionType: formData.connectionType,
        macAddress: formData.macAddress || undefined,
        currency: formData.currency,
      });

      router.push(`/subscribers/${subscriberId}`);
    } catch (err: unknown) {
      setError(
        userFacingMessage(err, "Failed to create subscriber"),
      );
      setIsSubmitting(false);
    }
  };

  if (plans === undefined) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">Loading…</div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Customers"
        title="Add subscriber"
        description="Create a new subscriber account"
        actions={
          <Link href="/subscribers" className="secondary-button">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to subscribers
          </Link>
        }
      />

      <div className="pf-panel">
        <form onSubmit={handleSubmit} className="wizard-form">
          {error && (
            <div
              style={{
                padding: "12px",
                marginBottom: "16px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--radius-sm)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Account number *</label>
            <input
              type="text"
              required
              value={formData.accountNumber}
              onChange={(e) =>
                setFormData({ ...formData, accountNumber: e.target.value })
              }
              placeholder="e.g., SUB-001"
            />
          </div>

          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Full name"
            />
          </div>

          <div className="form-group">
            <label>Phone *</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="e.g., +254712345678"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="email@example.com"
            />
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder="Network username"
            />
          </div>

          <div className="form-group">
            <label>Connection type *</label>
            <select
              required
              value={formData.connectionType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  connectionType: e.target.value as "pppoe" | "hotspot",
                })
              }
            >
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </select>
          </div>

          <div className="form-group">
            <label>Plan</label>
            <select
              value={formData.planId}
              onChange={(e) =>
                setFormData({ ...formData, planId: e.target.value })
              }
            >
              <option value="">Select a plan</option>
              {plans.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {plan.name} - {plan.currency} {plan.priceLocal}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>MAC address</label>
            <input
              type="text"
              value={formData.macAddress}
              onChange={(e) =>
                setFormData({ ...formData, macAddress: e.target.value })
              }
              placeholder="00:11:22:33:44:55"
            />
          </div>

          <div className="wizard-actions">
            <Link href="/subscribers" className="secondary-button">
              Cancel
            </Link>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create subscriber"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
