"use client";

import { useConvexAuth } from "@/app/lib/convex";
import { useAction } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";

/**
 * Runs once after login to mirror the already-authorized WorkOS organization
 * membership. Unknown organizations are denied until explicitly provisioned;
 * the client never auto-adds a user to Platform.
 */
export function OrgGuard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const syncOrganization = useAction(api.workos.syncActiveOrganizationMembership);
  const completed = useRef(false);
  const attempts = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (isLoading || !isAuthenticated || completed.current) return;
    attempts.current += 1;
    const retry = () => {
      // A network reconnect can occur while Convex is completing the action.
      // Retry the idempotent membership check before surfacing an error so a
      // new user is not stranded by a momentary connection loss.
      if (attempts.current < 4) {
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          setRetryNonce((value) => value + 1);
        }, 600 * attempts.current);
        return;
      }
    };

    syncOrganization()
      .then((result) => {
        if (result.status === "error" || result.status === "denied") {
          retry();
          return;
        }
        completed.current = true;
      })
      .catch(() => {
        retry();
      })
      .finally(() => undefined);

    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [isAuthenticated, isLoading, syncOrganization, retryNonce]);

  // This is a background reconciliation step. Details stay in server logs;
  // no identity-provider, cookie, or provisioning state is rendered to users.
  return null;
}

