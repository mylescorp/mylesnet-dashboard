"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronRight, CircleDot, RadioTower, ShieldPlus } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { useUserProfile } from "./UserProfileContext";

const opsPageLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/routers": "Router estate",
  "/incidents": "Incident desk",
  "/shift-notes": "Shift handover",
  "/usage": "Usage reports",
  "/business-activity": "Business activity",
  "/centipid": "Billing integration",
};

const platformPageLabels: Record<string, string> = {
  "/platform": "Dashboard",
  "/platform/markets": "Markets",
  "/platform/prospects": "Prospects",
  "/platform/devices": "Devices",
  "/platform/agents": "Agents",
  "/platform/agents/invite": "Invite agent",
  "/platform/vouchers": "Vouchers",
  "/platform/commissions": "Commissions",
  "/platform/alerts": "Alerts",
  "/platform/tickets": "Tickets",
  "/platform/comms": "Comms",
  "/platform/leaderboard": "Leaderboard",
  "/platform/trash": "Trash",
  "/platform/audit-log": "Audit Log",
  "/platform/access": "Access Management",
};

function getBreadcrumbData(pathname: string): { section: string; page: string; isPlatform: boolean } {
  const isPlatform = pathname.startsWith("/platform");

  if (isPlatform) {
    if (platformPageLabels[pathname]) {
      return { section: "Control Panel", page: platformPageLabels[pathname], isPlatform: true };
    }
    if (pathname.startsWith("/platform/markets/")) {
      return { section: "Control Panel", page: "Market Details", isPlatform: true };
    }
    if (pathname.startsWith("/platform/agents/")) {
      return { section: "Control Panel", page: "Agent Details", isPlatform: true };
    }
    const parts = pathname.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1] ?? "Overview";
    const formatted = lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, " ");
    return { section: "Control Panel", page: formatted, isPlatform: true };
  }

  const page = opsPageLabels[pathname] ?? "Overview";
  return { section: "Network Ops", page, isPlatform: false };
}

export function UnifiedTopbar() {
  const pathname = usePathname();
  const { user } = useUserProfile();
  const { section, page, isPlatform } = getBreadcrumbData(pathname);

  return (
    <header className="unified-topbar">
      {/* Left side: Breadcrumb & Workspace Live Indicator */}
      <div className="topbar-left">
        <nav className="unified-breadcrumb" aria-label="Breadcrumb navigation">
          <span className="breadcrumb-workspace-pill">
            {isPlatform ? (
              <ShieldPlus size={14} className="pill-icon-platform" />
            ) : (
              <RadioTower size={14} className="pill-icon-ops" />
            )}
            <span>{section}</span>
          </span>
          <ChevronRight aria-hidden="true" size={15} className="breadcrumb-separator" />
          <strong className="breadcrumb-page-title">{page}</strong>
        </nav>

        <div className="live-indicator-badge" title="Live status connected">
          <CircleDot size={12} className="pulse-dot" />
          <span>{isPlatform ? "Control Panel Active" : "Network Live"}</span>
        </div>
      </div>

      {/* Right side: Notifications, Theme Switcher & User Profile Dropdown */}
      <div className="topbar-right">
        <button
          type="button"
          className="topbar-icon-btn"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell aria-hidden="true" size={18} />
          <span className="notification-dot" />
        </button>

        <ThemeToggle />

        {/* Professional User Profile Dropdown */}
        <UserProfileDropdown user={user} />
      </div>
    </header>
  );
}
