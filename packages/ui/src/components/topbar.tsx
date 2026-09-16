"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Menu, Search, X } from "lucide-react";
import type { BreadcrumbItem, RouteIndexItem } from "../types";

export function Topbar({
  breadcrumb = [],
  routeIndex = [],
  onMenuClick,
  onNavigate,
  right,
}: {
  breadcrumb?: BreadcrumbItem[];
  routeIndex?: RouteIndexItem[];
  onMenuClick: () => void;
  onNavigate: (href: string) => void;
  right?: ReactNode;
}) {
  return (
    <header className="unified-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <nav className="unified-breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.map((crumb, i) => {
            const last = i === breadcrumb.length - 1;
            const sep = i > 0;
            return (
              <Fragment key={`${crumb.label}-${i}`}>
                {sep ? (
                  <span className="breadcrumb-separator" aria-hidden="true">
                    /
                  </span>
                ) : null}
                {last || !crumb.href ? (
                  <span className="breadcrumb-page-title" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <a className="breadcrumb-workspace-pill" href={crumb.href}>
                    {crumb.label}
                  </a>
                )}
              </Fragment>
            );
          })}
        </nav>
      </div>

      <div className="topbar-right">
        <SearchButton
          routeIndex={routeIndex}
          onNavigate={onNavigate}
        />
        {right}
      </div>
    </header>
  );
}

function SearchButton({
  routeIndex,
  onNavigate,
}: {
  routeIndex: RouteIndexItem[];
  onNavigate: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return routeIndex.slice(0, 20);
    const q = query.toLowerCase();
    return routeIndex
      .filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.group.toLowerCase().includes(q) ||
          r.href.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [routeIndex, query]);

  return (
    <>
      <button
        type="button"
        className="topbar-search-btn topbar-icon-btn"
        onClick={() => setOpen(true)}
        aria-label="Search pages"
      >
        <Search size={17} aria-hidden="true" />
        <kbd className="search-kbd" aria-hidden="true">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <SearchPalette
          results={results}
          query={query}
          onQueryChange={setQuery}
          onNavigate={(href) => {
            setOpen(false);
            onNavigate(href);
          }}
          onClose={() => setOpen(false)}
          inputRef={inputRef}
        />
      ) : null}
    </>
  );
}

function SearchPalette({
  results,
  query,
  onQueryChange,
  onNavigate,
  onClose,
  inputRef,
}: {
  results: RouteIndexItem[];
  query: string;
  onQueryChange: (q: string) => void;
  onNavigate: (href: string) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      onNavigate(results[active].href);
    }
  };

  useEffect(() => {
    setActive(0);
  }, [query]);

  return (
    <div
      className="search-palette-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search pages"
    >
      <div className="search-palette">
        <div className="search-palette-input-wrap">
          <Search size={17} aria-hidden="true" style={{ color: "var(--muted)", flex: "none" }} />
          <input
            ref={inputRef}
            className="search-palette-input"
            placeholder="Search pages…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKey}
            aria-label="Search pages"
          />
          <button
            type="button"
            className="search-palette-close"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="search-palette-list" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <div className="search-palette-empty">No pages match your search</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.href}
                type="button"
                className={`search-palette-item${i === active ? " search-palette-item-active" : ""}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => onNavigate(item.href)}
              >
                <span className="search-palette-item-label">{item.label}</span>
                <span className="search-palette-item-group">{item.group}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
