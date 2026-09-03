"use client";

import { useConvexAuth } from "convex/react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";

/**
 * Runs once after login to synchronize an already-authorized identity with
 * the local profile record. Workspace invitations remain owner-controlled;
 * an account without an invitation is an expected state, not a client error.
 */
export function OrgGuard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureOrg = useAction(api.workos.ensureOrgMembership);
  const ran = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || ran.current) return;
    ran.current = true;

    ensureOrg()
      .catch(() => {
        // Authentication and authorization are enforced by protected server
        // functions. Avoid exposing operational details in the browser.
      });
  }, [isAuthenticated, isLoading, ensureOrg]);

  return null;
}
