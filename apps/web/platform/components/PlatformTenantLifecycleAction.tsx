"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@/app/lib/convex";
import { tenantControl } from "@/lib/convex/tenantControl";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { canManagePlatformTenants } from "@/platform/permissions";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

export function PlatformTenantLifecycleAction({ tenantId, action }: { tenantId: string; action: "suspend" | "restore" }) {
  const router = useRouter();
  const { user } = useUserProfile();
  const tenant = useQuery(tenantControl.getTenantDetail, { tenantId });
  const setStatus = useMutation(tenantControl.setStatus);
  const restoreDeletion = useMutation(tenantControl.restoreScheduledDeletion);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const canManage = canManagePlatformTenants(user?.roles.map(role => role.slug));

  if (tenant === undefined) return <main className="workspace-page"><p className="pf-muted">Loading organization…</p></main>;
  if (!tenant) return <main className="workspace-page"><EmptyState title="Organization not found" body="This organization is unavailable or has been removed." /></main>;

  const eligible = action === "suspend"
    ? tenant.status === "trial" || tenant.status === "active"
    : tenant.status === "suspended" || tenant.status === "pending_deletion";
  const isDeletionRestore = action === "restore" && tenant.status === "pending_deletion";
  const verb = action === "suspend" ? "Suspend" : isDeletionRestore ? "Cancel deletion for" : "Restore";

  async function applyAction() {
    setWorking(true);
    setError(null);
    try {
      if (isDeletionRestore) await restoreDeletion({ tenantId });
      else await setStatus({ tenantId, status: action === "suspend" ? "suspended" : "active" });
      setDone(true);
      router.refresh();
    } catch (caught) {
      setError(userFacingMessage(caught, `Organization could not be ${action === "suspend" ? "suspended" : "restored"}.`));
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="workspace-page">
      <header className="page-heading"><div><p className="eyebrow"><Link href={`/platform/organizations/${tenantId}`}>Organization</Link></p><h1 className="page-title">{verb} {tenant.name}</h1><p className="page-subtitle">Review the lifecycle change and its effect on tenant access.</p></div></header>
      {error ? <p role="alert" className="platform-claim-message">{error}</p> : null}
      {done ? <p role="status" className="platform-claim-message ok">{tenant.name} lifecycle updated. <Link href={`/platform/organizations/${tenantId}`}>Return to organization</Link></p> : null}
      <section className="pf-panel" style={{ maxWidth: 680 }}>
        <div className="section-heading"><div><p className="eyebrow">Current state</p><h2>{tenant.name}</h2></div><StatusPill tone={tenant.status === "active" ? "success" : tenant.status === "suspended" || tenant.status === "pending_deletion" ? "danger" : "warning"}>{tenant.status === "pending_deletion" ? "pending deletion" : tenant.status}</StatusPill></div>
        {action === "suspend" ? <><p>Tenant workspace data access will be denied while suspended. Existing organization records and membership history remain in place. This action does not cancel the organization.</p><p className="pf-muted">Current lifecycle state will be saved so restoration returns it to {tenant.status}.</p></> : isDeletionRestore ? <><p>Cancel this tenant’s scheduled deletion and restore the workspace before the 30-day recovery window ends.</p><p className="pf-muted">Recovery window ends: {tenant.scheduledDeletionAt ? new Date(tenant.scheduledDeletionAt).toLocaleString() : "unavailable"}.</p></> : <><p>Restore this suspended organization to its previous lifecycle state.</p><p className="pf-muted">Target state: {tenant.statusBeforeSuspension ?? "active"}.</p></>}
        {!canManage ? <p className="platform-claim-message" role="alert">Your platform role can view this page but cannot change tenant lifecycle.</p> : null}
        {!eligible && canManage ? <p className="pf-muted">This organization is not in a state that supports this action.</p> : null}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Link href={`/platform/organizations/${tenantId}`} className="secondary-button">Cancel</Link>
          {!done && canManage && eligible ? <button type="button" className={action === "suspend" ? "secondary-button" : "primary-button"} disabled={working} onClick={() => void applyAction()}>{working ? "Saving…" : `Confirm ${verb.toLowerCase()}`}</button> : null}
        </div>
      </section>
    </main>
  );
}
