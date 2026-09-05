"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import { useSidebarState } from "./useSidebarState";
import { useUserProfile } from "./UserProfileContext";
import { canAccess, effectiveRole, navSections } from "./nav";

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

  const role = effectiveRole(user?.platformRole ?? null);
  const effectiveCollapsed = isMobile ? false : collapsed;

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccess(role, item)),
    }))
    .filter((section) => section.items.length > 0);

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

      {/* Navigation Sections */}
      <nav className="sidebar-nav" aria-label="Sidebar navigation">
        {visibleSections.map((section) => (
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