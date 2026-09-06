"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Sidebar from "./Sidebar";
import { UnifiedTopbar } from "./UnifiedTopbar";
import { UserProfileProvider, useUserProfile } from "./UserProfileContext";
import { canAccess, findNavEntry } from "./nav";
import { ShieldPlus } from "lucide-react";

function ClaimOwnerScreen() {
  const claimOwner = useAction(api.bootstrap.claimPlatformOwner);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const handleClaim = async () => {
    setClaiming(true);
    setClaimMessage(null);
    try {
      await claimOwner();
      setClaimMessage("You are now the platform owner. Welcome.");
      setTimeout(() => window.location.reload(), 1100);
    } catch (error) {
      setClaimMessage(error instanceof Error ? error.message : "Could not claim the owner role.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="platform-standalone">
      <div className="platform-card">
        <p className="eyebrow">First-time platform setup</p>
        <h1 className="page-title">Claim the Master Admin panel</h1>
        <p className="page-subtitle">
          No platform owner is registered yet. Claim the owner role to unlock the Master
          Admin panel for your account. This can only be done once.
        </p>
        <button type="button" className="primary-button" onClick={handleClaim} disabled={claiming}>
          <ShieldPlus aria-hidden="true" size={18} />
          {claiming ? "Claiming…" : "Claim owner role"}
        </button>
        {claimMessage && (
          <p
            className={`platform-claim-message ${claimMessage.startsWith("You are") ? "ok" : ""}`}
            role="status"
            style={{ marginTop: 16 }}
          >
            {claimMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function UnifiedShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isSignin = pathname === "/signin";
  const isNoAccess = pathname === "/no-access";

  const { user, isLoading: userLoading } = useUserProfile();
  const claimStatus = useQuery(api.bootstrap.ownerClaimStatus, {});
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDelayed(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Redirect to signin if unauthenticated (but wait for user profile to load)
  useEffect(() => {
    if (!isSignin && !isNoAccess && delayed && !userLoading && user === null) {
      router.replace("/signin");
    }
  }, [isSignin, isNoAccess, delayed, userLoading, user, router]);

  const profileReady = user !== undefined;
  const entry = findNavEntry(pathname);
  const denied = profileReady && !!user && !!entry && !canAccess(user.permissions ?? [], entry.item);

  // Handle role-gated route access (fail closed, friendly redirect)
  useEffect(() => {
    if (!isSignin && !isNoAccess && profileReady && denied) {
      router.replace("/no-access");
    }
  }, [isSignin, isNoAccess, profileReady, denied, router]);

  const canClaimFirstOwner =
    !userLoading && user && !user.isPlatform && pathname === "/dashboard" && claimStatus && !claimStatus.ownerExists;

  // Render children directly on sign-in page
  if (isSignin) {
    return <>{children}</>;
  }

  // Show loading state while user profile is being synced
  if (userLoading) {
    return (
      <div className="app-shell">
        <div className="app-content">
          <main className="app-main">
            <div className="workspace-page">
              <div className="loading-panel workspace-card">
                <p>Loading your profile…</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Handle owner claim screen for first owner
  if (canClaimFirstOwner) {
    return <ClaimOwnerScreen />;
  }

  return (
    <div className="app-shell">
      {/* Single Main Master Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="app-content">
        {/* Unified Professional Topbar with User Profile Dropdown */}
        <UnifiedTopbar />

        {/* Page Content */}
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}

export function UnifiedShell({ children }: { children: ReactNode }) {
  return (
    <UserProfileProvider>
      <UnifiedShellContent>{children}</UnifiedShellContent>
    </UserProfileProvider>
  );
}