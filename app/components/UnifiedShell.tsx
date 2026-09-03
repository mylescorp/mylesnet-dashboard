"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Sidebar from "./Sidebar";
import { UnifiedTopbar } from "./UnifiedTopbar";
import { UserProfileProvider, useUserProfile } from "./UserProfileContext";
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
  const isPlatformRoute = pathname.startsWith("/platform");

  const { user } = useUserProfile();
  const claimStatus = useQuery(api.bootstrap.ownerClaimStatus, {});
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDelayed(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Redirect to signin if unauthenticated
  useEffect(() => {
    if (!isSignin && delayed && user === null) {
      router.replace("/signin");
    }
  }, [isSignin, delayed, user, router]);

  const canClaimFirstOwner =
    user && !user.isPlatform && pathname === "/platform" && claimStatus && !claimStatus.ownerExists;

  // Handle unauthorized platform route access
  useEffect(() => {
    if (isPlatformRoute && delayed && user && !user.isPlatform && !canClaimFirstOwner) {
      router.replace("/platform/unauthorized");
    }
  }, [isPlatformRoute, delayed, user, router, canClaimFirstOwner]);

  // Render children directly on sign-in page
  if (isSignin) {
    return <>{children}</>;
  }

  // Handle owner claim screen for first owner
  if (isPlatformRoute && canClaimFirstOwner) {
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
