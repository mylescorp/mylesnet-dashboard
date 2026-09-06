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
  const ran = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || ran.current) return;
    ran.current = true;
    setIsSyncing(true);

    ensureOrg()
      .then((result) => {
        console.log("Organization membership status:", result);
      })
      .catch((error) => {
        console.error("Organization membership sync failed:", error);
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, [isAuthenticated, isLoading, ensureOrg]);

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

  return null;
}
