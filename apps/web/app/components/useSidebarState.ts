"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "mylesnet-dashboard-sidebar-collapsed";
const TOGGLE_EVENT = "mylesnet-sidebar-toggle";

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setMounted(true);
      try {
        setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }
    }, 0);

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ collapsed: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.collapsed === "boolean") {
        const nextVal = customEvent.detail.collapsed;
        setCollapsed((prev) => (prev !== nextVal ? nextVal : prev));
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const nextVal = e.newValue === "true";
        setCollapsed((prev) => (prev !== nextVal ? nextVal : prev));
      }
    };

    window.addEventListener(TOGGLE_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener(TOGGLE_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    const closeDrawer = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(closeDrawer);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore localStorage write errors
      }
      return next;
    });

    // Notify other components asynchronously to prevent synchronous setState during render
    setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const currentCollapsed = stored === "true";
        window.dispatchEvent(
          new CustomEvent(TOGGLE_EVENT, { detail: { collapsed: currentCollapsed } })
        );
      } catch {
        // Ignore
      }
    }, 0);
  };

  const toggleMobileOpen = () => {
    setMobileOpen((prev) => !prev);
  };

  const closeMobile = () => {
    setMobileOpen(false);
  };

  return {
    collapsed: mounted ? collapsed : false,
    mounted,
    toggleCollapsed,
    mobileOpen,
    toggleMobileOpen,
    closeMobile,
    setMobileOpen,
  };
}
