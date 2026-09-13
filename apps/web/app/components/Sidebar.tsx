"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import { useSidebarState } from "./useSidebarState";
import { useUserProfile } from "./UserProfileContext";
import { canAccess, navSections } from "./nav";

interface SidebarProps {
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

const SECTION_STORAGE_KEY = "mylesnet-dashboard-sidebar-sections";

function loadSectionState(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function Sidebar({ isMobile = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { collapsed, toggleCollapsed } = useSidebarState();
  const { user } = useUserProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  const effectiveCollapsed = isMobile ? false : collapsed;

  const ability = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);

  const showIncidentBadge = ability.has("incidents:read");
  const showDeviceBadge = ability.has("devices:read");
  const openIncidents = useQuery(api.incidents.getOpenIncidents, showIncidentBadge ? {} : "skip");
  const deviceRows = useQuery(api.devices.listDevices, showDeviceBadge ? {} : "skip");

  const badges = useMemo(() => {
    const map: Record<string, number> = {};
    if (openIncidents && openIncidents.length > 0) map["/incidents"] = openIncidents.length;
    const pending = (deviceRows ?? []).filter((d) => d.status !== "deleted" && d.role === "site_ap" && d.status === "unverified").length;
    if (pending > 0) map["/devices"] = pending;
    return map;
  }, [openIncidents, deviceRows]);

  const visibleSections = useMemo(
    () => navSections
      .map((section) => ({ ...section, items: section.items.filter((item) => canAccess(ability, item)) }))
      .filter((section) => section.items.length > 0),
    [ability],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = loadSectionState();
      const activeSection = visibleSections.find((section) =>
        section.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")),
      );
      if (activeSection) {
        stored[activeSection.title] = true;
      } else if (visibleSections.length === 1) {
        stored[visibleSections[0].title] = true;
      }
      setOpenSections(stored);
      try {
        window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(stored));
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, visibleSections]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [title]: prev[title] === false };
      try {
        window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

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
          <span className="sidebar-mark" aria-hidden="true">M</span>
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
        {visibleSections.map((section) => {
          const isOpen = effectiveCollapsed ? true : openSections[section.title] !== false;
          const activeSection = section.items.some((item) => isItemActive(item));
          const SectionIcon = section.icon;

          if (effectiveCollapsed) {
            const flyoutOpen = hoveredSection === section.title;
            return (
              <div
                key={section.title}
                className="sidebar-rail-group"
                onMouseEnter={() => setHoveredSection(section.title)}
                onMouseLeave={() => setHoveredSection(null)}
                onFocusCapture={() => setHoveredSection(section.title)}
                onBlurCapture={(event) => {
                  const nextFocus = event.relatedTarget;
                  if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) setHoveredSection(null);
                }}
              >
                <button
                  type="button"
                  className={`sidebar-rail-trigger ${activeSection ? "sidebar-rail-trigger-active" : ""}`}
                  onClick={() => setHoveredSection(section.title)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setHoveredSection(null);
                    }
                  }}
                  aria-expanded={flyoutOpen}
                  aria-label={`${section.title} navigation group`}
                  title={section.title}
                >
                  <SectionIcon aria-hidden="true" size={19} strokeWidth={1.8} />
                  <span className="sr-only">{section.title}</span>
                </button>
                {flyoutOpen ? (
                  <div className="sidebar-group-flyout" aria-label={`${section.title} pages`}>
                    <div className="sidebar-group-flyout-head"><span>{section.title}</span><small>{section.items.length}</small></div>
                    <div className="sidebar-group-flyout-items">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = isItemActive(item);
                        const badge = badges[item.href];
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-group-flyout-link ${active ? "sidebar-group-flyout-link-active" : ""}`}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setHoveredSection(null)}
                          >
                            <Icon aria-hidden="true" size={16} strokeWidth={1.9} />
                            <span>{item.label}</span>
                            {badge !== undefined && badge > 0 ? <b>{badge}</b> : null}
                            {item.planned ? <em>soon</em> : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <div key={section.title} className="sidebar-section">
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                className={`sidebar-section-header ${activeSection ? "sidebar-section-header-active" : ""}`}
                aria-expanded={isOpen}
                aria-label={effectiveCollapsed ? `${section.title} navigation group` : undefined}
                title={effectiveCollapsed ? section.title : undefined}
              >
                <span className="sidebar-section-label">{section.title}</span>
                <ChevronDown aria-hidden="true" size={14} className={`sidebar-section-chevron ${isOpen ? "" : "sidebar-section-chevron-closed"}`} />
              </button>
              {isOpen ? (
                <div className="sidebar-section-items">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item);
                    const badge = badges[item.href];
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
                        <span className="sidebar-link-text">
                          <span>{item.label}</span>
                          {badge !== undefined && badge > 0 ? (
                            <span className="sidebar-badge">{badge}</span>
                          ) : null}
                          {item.planned && <span className="sidebar-planned" title="Planned module">soon</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        {visibleSections.length === 0 ? <p className="sidebar-empty">No modules available for your role.</p> : null}
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

