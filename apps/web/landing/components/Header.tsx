"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import logo from "../assets/logo.png";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { NAV_SECTIONS, type NavChild, type NavGroup } from "@/landing/content/navigation";

/**
 * Fallback for sections without authored groups: children flow into
 * side-by-side columns (up to three), each a vertical stack like Centipid's
 * 264px mega columns.
 */
const chunkColumns = (children: NavChild[]): NavGroup[] => {
  const columnCount = Math.min(3, Math.max(1, Math.ceil(children.length / 2)));
  const perColumn = Math.ceil(children.length / columnCount);
  return Array.from({ length: columnCount }, (_, index) => ({
    title: "",
    children: children.slice(index * perColumn, (index + 1) * perColumn),
  }));
};

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Which dropdown columns have been expanded past their compact cap
  // (a "View all" reveal in the Resources panel).
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  // Opens a dropdown, clamping the wide Centipid-style panel into the viewport.
  // The panel is centered on its trigger, so left/right-edge triggers would
  // otherwise push it off-screen; --dd-shift nudges it back like Centipid's
  // JS-computed --mega-x offset. Measured while hidden (visibility, not
  // display, so the panel is laid out), before the open transition starts.
  const openDropdown = (href: string, itemEl: HTMLElement | null) => {
    const ddEl = itemEl?.querySelector<HTMLDivElement>(".landing-nav-dropdown");
    if (itemEl && ddEl) {
      const viewportWidth = document.documentElement.clientWidth;
      const itemRect = itemEl.getBoundingClientRect();
      const width = ddEl.getBoundingClientRect().width;
      const center = itemRect.left + itemRect.width / 2;
      const left = center - width / 2;
      let shift = 0;
      if (left < 8) shift = 8 - left;
      else if (left + width > viewportWidth - 8) shift = viewportWidth - 8 - (left + width);
      ddEl.style.setProperty("--dd-shift", `${Math.round(shift)}px`);
    }
    setOpenMenu(href);
  };

  // Any navigation closes whatever was open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenMenu((prev) => (prev === null ? null : null));
  }, [pathname]);

  // Close the open dropdown on outside click or Escape, so it behaves like a menu.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  return (
    <header className="landing-header">
      <nav className="landing-nav landing-container" aria-label="Main navigation">
        <Link className="landing-brand" href="/" aria-label="MylesNet home">
          <Image className="landing-logo" src={logo} alt="" width={48} height={32} preload />
          <span className="landing-brand-name">
            Myles<span className="landing-brand-accent">Net</span>
          </span>
        </Link>

        <div className="landing-nav-links" ref={navRef}>
          {NAV_SECTIONS.map((section) => {
            const isActive =
              pathname === section.href || pathname.startsWith(`${section.href}/`);
            const hasChildren = Boolean(section.children?.length);

            if (!hasChildren) {
              return (
                <Link
                  key={section.href}
                  className="landing-nav-link"
                  href={section.href}
                  data-active={isActive ? "true" : undefined}
                  aria-current={pathname === section.href ? "page" : undefined}
                >
                  {section.label}
                </Link>
              );
            }

            const isOpen = openMenu === section.href;
            // Centipid-style panel: authored groups render as titled columns,
            // anything else is split evenly across up to three columns.
            const groups = section.groups?.length
              ? section.groups
              : chunkColumns(section.children ?? []);
            return (
              <div
                className="landing-nav-item"
                data-open={isOpen ? "true" : undefined}
                key={section.href}
                onPointerEnter={(event) => openDropdown(section.href, event.currentTarget)}
                onPointerLeave={() => setOpenMenu(null)}
                onBlur={(event) => {
                  const next = event.relatedTarget;
                  if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
                    setOpenMenu(null);
                  }
                }}
              >
                <Link
                  className="landing-nav-link landing-nav-link-trigger"
                  href={section.href}
                  data-active={isActive ? "true" : undefined}
                  data-expanded={isOpen ? "true" : undefined}
                  aria-current={pathname === section.href ? "page" : undefined}
                  aria-haspopup="true"
                  aria-expanded={isOpen}
                  onFocus={(event) => openDropdown(section.href, event.currentTarget.closest<HTMLElement>(".landing-nav-item"))}
                >
                  {section.label}
                  <ChevronDown size={14} aria-hidden="true" className="landing-nav-chevron" />
                </Link>
                <div className="landing-nav-dropdown">
                  <p className="landing-nav-dropdown-kicker">{section.label}</p>
                  <div className="landing-nav-dropdown-list">
                    {groups.map((group, groupIndex) => {
                      const maxVisible = group.maxVisible ?? group.children.length;
                      const capped = group.maxVisible !== undefined && group.children.length > maxVisible;
                      const expanded = expandedGroups[group.title ?? ""] === true;
                      const shown = capped && !expanded ? group.children.slice(0, maxVisible) : group.children;
                      const hidden = capped ? group.children.length - maxVisible : 0;
                      return (
                        <div
                          className="landing-nav-dropdown-column"
                          key={group.title || groupIndex}
                        >
                          {group.title ? (
                            <p className="landing-nav-dropdown-col-title">{group.title}</p>
                          ) : null}
                          <ul className="landing-nav-dropdown-column-list">
                            {shown.map((child) => (
                              <li key={child.href}>
                                <Link
                                  className="landing-nav-dropdown-link"
                                  href={child.href}
                                  data-active={pathname === child.href ? "true" : undefined}
                                  aria-current={pathname === child.href ? "page" : undefined}
                                >
                                  {child.label}
                                  {child.description ? (
                                    <span className="landing-nav-dropdown-desc">
                                      {child.description}
                                    </span>
                                  ) : null}
                                </Link>
                              </li>
                            ))}
                          </ul>
                          {capped ? (
                            <button
                              type="button"
                              className="landing-nav-dropdown-more"
                              aria-expanded={expanded ? "true" : "false"}
                              onClick={() =>
                                setExpandedGroups((prev) => ({
                                  ...prev,
                                  [group.title ?? ""]: !prev[group.title ?? ""],
                                }))
                              }
                            >
                              {expanded ? "Show fewer" : `${group.moreLabel ?? "View all"} (+${hidden})`}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {section.aside?.length ? (
                    <div className="landing-nav-dropdown-aside">
                      {section.aside.map((link) => (
                        <Link
                          key={link.href}
                          className="landing-nav-dropdown-chip"
                          href={link.href}
                          data-active={pathname === link.href ? "true" : undefined}
                          aria-current={pathname === link.href ? "page" : undefined}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="landing-nav-cta">
          <ThemeToggle className="landing-theme-toggle" />
          <Button asChild variant="ghost" size="sm" className="landing-signin">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild variant="default" size="sm" className="landing-signup">
            <Link href="/get-started">Talk to our team</Link>
          </Button>
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="landing-nav-toggle"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 mt-8" aria-label="Mobile navigation">
              {NAV_SECTIONS.map((section) => {
                const isActive =
                  pathname === section.href || pathname.startsWith(`${section.href}/`);
                return (
                  <div key={section.href} className="landing-mobile-group">
                    <Link
                      className="text-lg font-medium transition-colors"
                      href={section.href}
                      data-active={isActive ? "true" : undefined}
                      onClick={() => setMenuOpen(false)}
                      aria-current={pathname === section.href ? "page" : undefined}
                    >
                      {section.label}
                    </Link>
                    {section.children?.length ? (
                      <ul className="landing-mobile-subnav">
                        {section.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={() => setMenuOpen(false)}
                              aria-current={pathname === child.href ? "page" : undefined}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
              <div className="landing-mobile-theme-row">
                <ThemeToggle className="landing-theme-toggle" />
                <Button asChild variant="ghost" className="flex-1" onClick={() => setMenuOpen(false)}>
                  <Link href="/signin">Sign in</Link>
                </Button>
                <Button asChild variant="default" className="flex-1" onClick={() => setMenuOpen(false)}>
                  <Link href="/get-started">Talk to our team</Link>
                </Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
