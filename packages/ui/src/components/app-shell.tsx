"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { shellStorageKeys } from "../utils";
import { SidebarRail } from "./sidebar-rail";
import { Topbar } from "./topbar";
import type { BreadcrumbItem, NavItem } from "../types";
import { Plus, X } from "lucide-react";

type SidebarVariant = "desktop" | "mobile";

interface ShellState {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  variant: SidebarVariant;
  onCloseDrawer: () => void;
}

interface TopbarState {
  onOpenDrawer: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function AppShell({
  renderSidebar,
  topbar,
  mobileTabs = [],
  mobileCreateAction,
  children,
}: {
  renderSidebar: (state: ShellState) => ReactNode;
  topbar: (ctx: TopbarState) => ReactNode;
  mobileTabs?: Array<Pick<NavItem, "href" | "label" | "icon"> & { active: boolean }>;
  mobileCreateAction?: { href: string; label: string };
  children: ReactNode;
}) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(shellStorageKeys.sidebar) === "1";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");

    const update = () => {
      if (desktop.matches) {
        setViewport("desktop");
        try {
          setCollapsed(localStorage.getItem(shellStorageKeys.sidebar) === "1");
        } catch {
          setCollapsed(false);
        }
      } else {
        setViewport("mobile");
      }
    };

    update();
    desktop.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
    };
  }, []);

  const onToggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(shellStorageKeys.sidebar, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const onOpenDrawer = useCallback(() => setDrawerOpen(true), []);
  const onCloseDrawer = useCallback(() => setDrawerOpen(false), []);

  const sidebarState: ShellState = useMemo(
    () => ({
      collapsed,
      onToggleCollapsed,
      variant: viewport === "mobile" ? "mobile" : "desktop",
      onCloseDrawer,
    }),
    [collapsed, onToggleCollapsed, viewport, onCloseDrawer],
  );

  const sidebarNode = renderSidebar(sidebarState);

  return (
    <div className="app-shell">
      {viewport === "mobile"
        ? drawerOpen
          ? (
              <div className="sidebar-overlay" data-testid="sidebar-overlay">
                <div className="sidebar-drawer-content">
                  <button
                    type="button"
                    className="sidebar-close-mobile"
                    onClick={onCloseDrawer}
                    aria-label="Close navigation"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                  {sidebarNode}
                </div>
              </div>
            )
          : null
        : sidebarNode}

      <div className="app-content">
        {topbar({ onOpenDrawer, collapsed, onToggleCollapsed })}
        <main className="app-main">{children}</main>
        {viewport === "mobile" && mobileCreateAction ? (
          <a className="mobile-create-button" href={mobileCreateAction.href} aria-label={mobileCreateAction.label} title={mobileCreateAction.label}>
            <Plus size={22} aria-hidden="true" />
          </a>
        ) : null}
        {mobileTabs.length > 0 ? (
          <nav className="mobile-tabbar" aria-label="Primary destinations">
            {mobileTabs.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={item.active ? "mobile-tab-active" : undefined}>
                  {Icon ? <Icon size={18} aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
