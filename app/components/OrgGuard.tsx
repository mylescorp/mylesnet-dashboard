"use client";

import { useConvexAuth } from "convex/react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";

/**
 * Runs once after login to ensure the WorkOS user is a member of the
 * MylesNet Platform organization. After adding the membership, it triggers
 * a single page reload so the JWT picks up organization_id and role claims.
 *
 * Safe and protected against infinite page reload loops.
 */
export function OrgGuard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureOrg = useAction(api.workos.ensureOrgMembership);
  const ran = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || ran.current) return;
    ran.current = true;

    ensureOrg()
      .then((result) => {
        if (result.status === "not_member") {
          console.error("The signed-in account is not assigned to this workspace.");
        }
      })
      .catch((err) => {
        console.error("Failed to ensure org membership:", err);
      });
  }, [isAuthenticated, isLoading, ensureOrg]);

  return null;
}
