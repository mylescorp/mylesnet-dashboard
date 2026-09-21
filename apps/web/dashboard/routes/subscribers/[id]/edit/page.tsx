"use client";

import { userFacingMessage } from "@/shared/lib/user-facing-error";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@mylesnet/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const STATUS_OPTIONS = [
  "active",
  "expired",
  "suspended",
  "disabled",
  "at_risk",
  "churned",
] as const;

function toDateInput(value: number | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function SubscriberEditForm({
  subscriber,
}: {
  subscriber: Doc<"subscribers">;
}) {
  const router = useRouter();
  const plans = useQuery(api.plans.listPlans, {});
  const updateSubscriber = useMutation(api.subscribers.update);

  const [formData, setFormData] = useState({
    name: subscriber.name,
    phone: subscriber.phone,
    email: subscriber.email ?? "",
    username: subscriber.username ?? "",
    planId: subscriber.planId ?? "",
    connectionType: subscriber.connectionType,
    macAddress: subscriber.macAddress ?? "",
    status: subscriber.status,
    expiryDate: toDateInput(subscriber.expiryDate),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await updateSubscriber({
        id: subscriber._id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        username: formData.username || undefined,
        planId: formData.planId ? (formData.planId as Id<"plans">) : undefined,
        connectionType: formData.connectionType,
        macAddress: formData.macAddress || undefined,
        status: formData.status,
        expiryDate: formData.expiryDate
          ? new Date(formData.expiryDate).getTime()
          : undefined,
      });
      router.push(`/subscribers/${subscriber._id}`);
    } catch (err: unknown) {
      setError(userFacingMessage(err, "Failed to update subscriber"));
      setIsSubmitting(false);
    }
  };

  return (
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
        <label>Account number</label>
        <input type="text" value={subscriber.accountNumber} disabled />
      </div>

      <div className="form-group">
        <label>Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Phone *</label>
        <input
          type="tel"
          required
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
          onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
        >
          <option value="">No plan assigned</option>
          {(plans ?? []).map((plan) => (
            <option key={plan._id} value={plan._id}>
              {plan.name} - {plan.currency} {plan.priceLocal}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Status</label>
        <select
          value={formData.status}
          onChange={(e) =>
            setFormData({
              ...formData,
              status: e.target.value as Doc<"subscribers">["status"],
            })
          }
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Expiry date</label>
        <input
          type="date"
          value={formData.expiryDate}
          onChange={(e) =>
            setFormData({ ...formData, expiryDate: e.target.value })
          }
        />
      </div>

      <div className="form-group">
        <label>MAC address</label>
        <input
          type="text"
          value={formData.macAddress}
          onChange={(e) =>
            setFormData({ ...formData, macAddress: e.target.value })
          }
        />
      </div>

      <div className="wizard-actions">
        <Link href={`/subscribers/${subscriber._id}`} className="secondary-button">
          Cancel
        </Link>
        <button
          type="submit"
          className="primary-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export default function EditSubscriberPage({
  params,
}: {
  params: { id: string };
}) {
  const { user } = useUserProfile();
  const subscriber = useQuery(api.subscribers.get, {
    id: params.id as Id<"subscribers">,
  });

  if (user === undefined || subscriber === undefined) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">Loading…</div>
      </div>
    );
  }

  const canUpdate = user?.permissions?.includes("subscribers:update") === true;

  if (!canUpdate) {
    return (
      <div className="workspace-page">
        <PageHeader
          eyebrow="Customers"
          title="Not authorized"
          description="You do not have permission to edit subscribers"
        />
        <div className="pf-panel">
          <Link href="/subscribers" className="secondary-button">
            Back to subscribers
          </Link>
        </div>
      </div>
    );
  }

  if (subscriber === null) {
    return (
      <div className="workspace-page">
        <PageHeader
          eyebrow="Customers"
          title="Subscriber not found"
          description="The requested subscriber does not exist"
        />
        <div className="pf-panel">
          <Link href="/subscribers" className="secondary-button">
            Back to subscribers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Customers"
        title="Edit subscriber"
        description={`Update ${subscriber.name}'s account details`}
        actions={
          <Link href={`/subscribers/${subscriber._id}`} className="secondary-button">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to subscriber
          </Link>
        }
      />
      <div className="pf-panel">
        <SubscriberEditForm subscriber={subscriber} />
      </div>
    </div>
  );
}
