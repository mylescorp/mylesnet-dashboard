"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Map,
  MapPinned,
  Megaphone,
  RadioTower,
  Settings2,
  ShieldPlus,
  Ticket,
  Trash2,
  TriangleAlert,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useSidebarState } from "./useSidebarState";
import { useUserProfile } from "./UserProfileContext";

const opsSections = [
  {
    title: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/routers", label: "Router estate", icon: RadioTower },
      { href: "/incidents", label: "Incident desk", icon: TriangleAlert },
    ],
  },
  {
    title: "Shift & Analytics",
    items: [
      { href: "/shift-notes", label: "Shift handover", icon: ClipboardList },
      { href: "/usage", label: "Usage reports", icon: BarChart3 },
      { href: "/business-activity", label: "Business activity", icon: CircleDollarSign },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/centipid", label: "Billing integration", icon: Settings2 },
    ],
  },
];

const platformSections = [
  {
    title: "Overview",
    items: [
      { href: "/platform", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/platform/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  {
    title: "Field Operations",
    items: [
      { href: "/platform/markets", label: "Markets", icon: Map },
      { href: "/platform/prospects", label: "Prospects", icon: MapPinned },
      { href: "/platform/devices", label: "Devices", icon: Boxes },
      { href: "/platform/agents", label: "Agents", icon: Users },
    ],
  },
  {
    title: "Revenue & Billing",
    items: [
      { href: "/platform/vouchers", label: "Vouchers", icon: Ticket },
      { href: "/platform/commissions", label: "Commissions", icon: CircleDollarSign },
    ],
  },
  {
    title: "Support & Audit",
    items: [
      { href: "/platform/access", label: "Access management", icon: ShieldPlus },
      { href: "/platform/alerts", label: "Alerts", icon: AlertTriangle },
      { href: "/platform/tickets", label: "Tickets", icon: ClipboardList },
      { href: "/platform/comms", label: "Comms", icon: Megaphone },
      { href: "/platform/trash", label: "Trash", icon: Trash2 },
      { href: "/platform/audit-log", label: "Audit Log", icon: History },
    ],
  },
];

interface SidebarProps {
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ isMobile = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { collapsed, toggleCollapsed } = useSidebarState();
  const { user } = useUserProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isPlatformMode = pathname.startsWith("/platform");
  const effectiveCollapsed = isMobile ? false : collapsed;
  const currentSections = isPlatformMode ? platformSections : opsSections;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace("/signin");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  const isItemActive = (item: { href: string; exact?: boolean }) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <aside
      className={`sidebar ${effectiveCollapsed ? "sidebar-collapsed" : ""} ${
        isMobile ? "sidebar-mobile" : ""
      }`}
    >
      {/* Permanent Brand Header (Constant MylesNet Logo) */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-inner">
          <Image
            src="/brand/mylesnet-logo.png"
            alt="MylesNet Logo"
            width={640}
            height={427}
            unoptimized
            priority
            className="sidebar-logo"
          />
        </div>

        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="sidebar-close-mobile"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="sidebar-collapse"
            aria-label={effectiveCollapsed ? "Expand navigation" : "Collapse navigation"}
            title={effectiveCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {effectiveCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        )}
      </div>

      {/* Privileged users may move between the two modules in the unified app. */}
      {!effectiveCollapsed && user?.isPlatform && (
        <div className="sidebar-workspace-switcher" role="tablist" aria-label="Workspace switcher">
          <button
            type="button"
            role="tab"
            aria-selected={!isPlatformMode}
            onClick={() => {
              if (isMobile && onCloseMobile) onCloseMobile();
              router.push("/dashboard");
            }}
            className={`switcher-tab ${!isPlatformMode ? "switcher-tab-active" : ""}`}
          >
            <RadioTower size={14} />
            <span>Network</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={isPlatformMode}
            onClick={() => {
              if (isMobile && onCloseMobile) onCloseMobile();
              router.push("/platform");
            }}
            className={`switcher-tab ${isPlatformMode ? "switcher-tab-active" : ""}`}
          >
            <ShieldPlus size={14} />
            <span>Platform</span>
          </button>
        </div>
      )}

      {/* Navigation Sections */}
      <nav className="sidebar-nav" aria-label="Sidebar navigation">
        {currentSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <p className="sidebar-section-label">{section.title}</p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={isMobile ? onCloseMobile : undefined}
                  className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  title={effectiveCollapsed ? item.label : undefined}
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Minimal Footer (Sign Out Only) */}
      <div className="sidebar-footer">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="sidebar-signout"
          title={effectiveCollapsed ? "Sign out" : undefined}
        >
          <LogOut aria-hidden="true" size={18} />
          <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}
