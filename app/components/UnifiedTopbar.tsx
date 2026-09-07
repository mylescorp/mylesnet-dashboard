"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronRight, CircleDot, Menu, RadioTower } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { useUserProfile } from "./UserProfileContext";
import { findNavEntry } from "./nav";
import Sidebar from "./Sidebar";

export function UnifiedTopbar() {
  const pathname = usePathname();
  const { user } = useUserProfile();
  const entry = findNavEntry(pathname);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const section = entry?.section.title ?? "MylesNet";
  let page = entry?.item.label ?? "Overview";
  if (pathname === "/agents/invite") {
    page = "Invite agent";
  } else if (entry?.isDetail) {
    page = `${entry.item.label} Details`;
  }

  return (
    <>
    <header className="unified-topbar">
      {/* Left side: Breadcrumb & Workspace Live Indicator */}
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={() => setMobileNavigationOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileNavigationOpen}
        >
          <Menu aria-hidden="true" size={19} />
        </button>
        <nav className="unified-breadcrumb" aria-label="Breadcrumb navigation">
          <span className="breadcrumb-workspace-pill">
            <RadioTower size={14} className="pill-icon-ops" />
            <span>{section}</span>
          </span>
          <ChevronRight aria-hidden="true" size={15} className="breadcrumb-separator" />
          <strong className="breadcrumb-page-title">{page}</strong>
        </nav>

        <div className="live-indicator-badge" title="Live status connected">
          <CircleDot size={12} className="pulse-dot" />
          <span>System Live</span>
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
    {mobileNavigationOpen ? (
      <div className="sidebar-overlay" role="presentation" onMouseDown={() => setMobileNavigationOpen(false)}>
        <div className="sidebar-drawer-content" role="dialog" aria-modal="true" aria-label="Navigation menu" onMouseDown={(event) => event.stopPropagation()}>
          <Sidebar isMobile onCloseMobile={() => setMobileNavigationOpen(false)} />
        </div>
      </div>
    ) : null}
    </>
  );
}
