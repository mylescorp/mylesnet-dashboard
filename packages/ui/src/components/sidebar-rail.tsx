"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { NavGroup, NavItem } from "../types";

export function SidebarRail({
  groups,
  pathname,
  brand,
  collapsed,
  onToggleCollapsed,
  homeHref = "/dashboard",
  variant = "desktop",
  footer,
  showCollapseControl = true,
}: {
  groups: NavGroup[];
  pathname: string;
  brand: { name: string; logo: string; mark?: ReactNode };
  collapsed: boolean;
  onToggleCollapsed: () => void;
  homeHref?: string;
  variant?: "desktop" | "mobile";
  footer?: ReactNode;
  showCollapseControl?: boolean;
}) {
  const [peekOpen, setPeekOpen] = useState(false);
  const canPeek = collapsed && variant === "desktop";
  const visuallyCollapsed = collapsed && !peekOpen;

  useEffect(() => {
    if (!canPeek) setPeekOpen(false);
  }, [canPeek]);

  const openPeek = () => {
    if (canPeek) setPeekOpen(true);
  };

  const closePeek = () => {
    if (canPeek) setPeekOpen(false);
  };

  return (
    <aside
      className={`sidebar${collapsed ? " sidebar-layout-collapsed" : ""}${visuallyCollapsed ? " sidebar-collapsed" : ""}${peekOpen ? " sidebar-peek" : ""}${variant === "mobile" ? " sidebar-mobile" : ""}`}
      aria-label="Primary navigation"
      onMouseEnter={openPeek}
      onMouseLeave={closePeek}
      onFocusCapture={openPeek}
      onBlurCapture={(event) => {
        const rail = event.currentTarget;
        requestAnimationFrame(() => {
          if (!rail.contains(document.activeElement)) closePeek();
        });
      }}
    >
      <div className="sidebar-surface">
        <div className="sidebar-brand">
          <div className="sidebar-brand-inner">
            <a className="sidebar-logo-link" href={homeHref} title={`${brand.name} home`}>
              {visuallyCollapsed && !showCollapseControl ? (
                <span className="sidebar-mark" aria-hidden="true">
                  {brand.mark ?? brand.name[0]}
                </span>
              ) : visuallyCollapsed ? null : (
                <img
                  className="sidebar-logo"
                  src={brand.logo}
                  alt={`${brand.name} home`}
                />
              )}
            </a>
          </div>
          {showCollapseControl ? (
            <button
              type="button"
              className="sidebar-collapse-top"
              onClick={() => {
                setPeekOpen(false);
                onToggleCollapsed();
              }}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
            </button>
          ) : null}
        </div>

        <nav className="sidebar-nav" aria-label="Sections">
          {groups.length === 0 ? (
            <p className="sidebar-empty">No sections available</p>
          ) : (
            groups.map((group) => (
              <SidebarSection
                key={group.id}
                group={group}
                pathname={pathname}
                collapsed={visuallyCollapsed}
              />
            ))
          )}
        </nav>

        {footer != null ? (
          <div className="sidebar-footer">
            {footer}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SidebarSection({
  group,
  pathname,
  collapsed,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="sidebar-section">
      {group.label ? (
        <button
          type="button"
          className="sidebar-section-header"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <h3 className="sidebar-section-label">{group.label}</h3>
          <ChevronDown
            size={14}
            className={`sidebar-section-chevron${open ? "" : " sidebar-section-chevron-closed"}`}
            aria-hidden="true"
          />
        </button>
      ) : null}
      {open || collapsed ? (
        <div className="sidebar-section-items">
          {group.items.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active =
    pathname === item.href ||
    (!item.exact &&
      item.href !== "/" &&
      (pathname === `${item.href}/` || pathname.startsWith(`${item.href}/`)));

  return (
    <a
      className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
    >
      {item.icon ? <item.icon size={18} aria-hidden="true" /> : null}
      <span className="sidebar-link-text">
        <span>{item.label}</span>
      </span>
    </a>
  );
}

