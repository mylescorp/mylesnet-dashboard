"use client";

import { useConvexAuth } from "convex/react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";

/**
 * Runs once after login to synchronize an already-authorized identity with
 * the local profile record. New users are automatically added to the platform
 * organization with a default role to enable dashboard access.
 */
export function OrgGuard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureOrg = useAction(api.workos.ensureOrgMembership);
  const completed = useRef(false);
  const attempts = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (isLoading || !isAuthenticated || completed.current) return;
    attempts.current += 1;
    setIsSyncing(true);
    setSyncError(null);
    let retryScheduled = false;

    const retry = (reason: string) => {
      // A network reconnect can occur while Convex is completing the action.
      // Retry the idempotent membership check before surfacing an error so a
      // new user is not stranded by a momentary connection loss.
      if (attempts.current < 4) {
        retryScheduled = true;
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          setRetryNonce((value) => value + 1);
        }, 600 * attempts.current);
        return;
      }
      setSyncError(reason);
    };

    ensureOrg()
      .then((result) => {
        console.log("Organization membership status:", result);
        if (result.status === "error") {
          retry(result.reason || "Failed to set up workspace access");
          return;
        }
        completed.current = true;
      })
      .catch((error) => {
        console.error("Organization membership sync failed:", error);
        retry(error instanceof Error ? error.message : "Failed to set up workspace access");
      })
      .finally(() => {
        if (!retryScheduled) setIsSyncing(false);
      });

    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [isAuthenticated, isLoading, ensureOrg, retryNonce]);

  // Show loading state while syncing organization membership
  if (isSyncing) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">
          <Activity aria-hidden="true" size={22} />
          <p>Setting up your workspace access…</p>
        </div>
      </div>
    );
  }

  // Show error state if sync failed
  if (syncError) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">
          <p className="error-message">Unable to set up workspace access: {syncError}</p>
          <p className="error-subtext">Please refresh the page or contact support.</p>
        </div>
      </div>
    );
  }

  return null;
}
