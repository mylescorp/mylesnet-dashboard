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
import type { BreadcrumbItem, NavGroup, RouteIndexItem } from "../types";
import { X } from "lucide-react";

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
  children,
}: {
  renderSidebar: (state: ShellState) => ReactNode;
  topbar: (ctx: TopbarState) => ReactNode;
  children: ReactNode;
}) {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
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
    const desktop = window.matchMedia("(min-width: 980px)");
    const tablet = window.matchMedia("(min-width: 768px) and (max-width: 979px)");

    const update = () => {
      if (tablet.matches) {
        setViewport("tablet");
        setCollapsed(true);
      } else if (desktop.matches) {
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
    tablet.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
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
      </div>
    </div>
  );
}

