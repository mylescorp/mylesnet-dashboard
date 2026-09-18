"use client";
/* eslint-disable @next/next/no-img-element -- authenticated Convex Storage URLs are runtime-generated. */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  ChevronDown,
  Laptop,
  LifeBuoy,
  LogOut,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@mylesnet/ui";
import { useUserProfile } from "./UserProfileContext";
import { UserProfileModal } from "./UserProfileModal";
import { trustedAvatarSource } from "@/app/lib/avatar";
import {
  setThemeMode,
  readStoredThemeMode,
  resolveThemeMode,
  type ThemeMode,
  type ResolvedTheme,
} from "@/lib/theme";
import type { ShellPanel } from "@/lib/navigation/product-nav";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}

interface DrawerItem {
  label: string;
  description?: string;
  href?: string;
  icon: ReactNode;
  show?: boolean;
  onNavigate?: () => void;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="acw-section-title">{children}</h3>;
}

function DrawerLink({ item }: { item: DrawerItem }) {
  const content = (
    <>
      <span className="acw-item-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="acw-item-text">
        <span className="acw-item-label">{item.label}</span>
        {item.description ? <small className="acw-item-desc">{item.description}</small> : null}
      </span>
    </>
  );

  if (!item.href) {
    return (
      <button type="button" className="acw-item" onClick={() => item.onNavigate?.()}>
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href} className="acw-item" onClick={() => item.onNavigate?.()}>
      {content}
    </Link>
  );
}

export function AccountDrawer({ panel = "dashboard" }: { panel?: ShellPanel }) {
  const { user } = useUserProfile();
  const { signOut } = useAuth();
  const online = useOnline();
  const isDesktop = useMediaQuery("(min-width: 980px)");

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const displayName = user?.name || user?.email || "Workspace user";
  const avatarSource = trustedAvatarSource(user?.image, Boolean(user?.avatarStorageId));
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  const toggle = () => {
    if (open) {
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    } else {
      const rect = triggerRef.current?.getBoundingClientRect();
      setAnchor(rect ? { top: rect.bottom + 10, right: window.innerWidth - rect.right } : null);
      setOpen(true);
    }
  };

  // Recompute anchor when the window resizes while the desktop menu is open.
  useEffect(() => {
    if (!open || !isDesktop) return;
    const compute = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setAnchor({ top: rect.bottom + 10, right: window.innerWidth - rect.right });
    };
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [open, isDesktop]);

  // Focus management + Escape + scroll lock while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    if (isDesktop) {
      panel?.focus();
    } else {
      document.body.style.overflow = "hidden";
      const focusables = panel?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), [tabindex]:not([tabindex='-1'])");
      (focusables?.[0] ?? panel)?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Tab" || !panel) return;
        const items = Array.from(panel.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), [tabindex]:not([tabindex='-1'])"));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
        previous?.focus?.();
      };
    }
    return () => previous?.focus?.();
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Outside click closes the drawer (popover mode has no backdrop).
  useEffect(() => {
    if (!open || !isDesktop) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, isDesktop]);

  const isPlatform = user?.isPlatform === true;
  const permissions = user?.permissions ?? [];
  const canManageAccess = permissions.includes("users:manage") || permissions.includes("roles:manage");
  const canViewAccounts = permissions.includes("users:read") || permissions.includes("users:manage");
  const canOpenAccess = canViewAccounts || canManageAccess;
  const canOpenTenantAdministration = panel === "admin" || (panel === "dashboard" && (user?.roles ?? []).some((role) => role.slug === "tenant_admin" || role.slug === "client_admin"));
  const canOpenWorkspaceSettings = (panel === "dashboard" || panel === "admin") || (panel === "platform" && isPlatform);
  const workspaceSettingsHref = panel === "platform" ? "/platform/settings" : "/settings";

  // Scope is established by the server and Convex, never inferred from a host
  // or a browser cookie. This neutral label avoids leaking an unverified scope.
  const workspaceLabel = panel === "platform" ? "MylesNet Platform" : "Tenant workspace";

  const rawRole = user?.primaryRole?.slug ?? user?.platformRole ?? "operator";
  const formattedRole = rawRole.replace("platform_", "").replace(/_/g, " ").toUpperCase();

  const closeTo = (action?: () => void) => () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
    action?.();
  };

  const items: DrawerItem[] = [
    {
      label: "Profile & photo",
      description: "Your name, avatar, phone and job title",
      icon: <User size={16} />,
      onNavigate: () => setProfileOpen(true),
    },
    {
      label: "Team & access",
      description: "People, roles and permissions",
      href: panel === "platform" ? "/platform/access" : "/access",
      icon: <ShieldCheck size={16} />,
      show: (panel === "platform" || panel === "admin" || panel === "dashboard") && canOpenAccess,
    },
    {
      label: "Audit log",
      description: "Record of every mutating action",
      href: isPlatform ? "/platform/audit" : "/audit-log",
      icon: <ScrollText size={16} />,
      show: panel === "platform" && permissions.includes("audit_log:read"),
    },
    {
      label: "Tenant administration",
      description: "Subscribers, plans, devices and tickets",
      href: "/admin",
      icon: <Users size={16} />,
      show: canOpenTenantAdministration,
    },
    {
      label: "Security",
      description: "Workspace security posture",
      href: "/platform/security",
      icon: <ShieldCheck size={16} />,
      show: panel === "platform" && isPlatform,
    },
  ];

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut({ returnTo: window.location.origin });
    } catch {
      setSigningOut(false);
      setSignOutError("We could not sign you out. Please check your connection and try again.");
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`user-avatar-btn${open ? " acw-trigger-open" : ""}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={titleId}
        aria-label={`Account: ${displayName}`}
      >
        <span className="mn-avatar" aria-hidden="true">
          {avatarSource ? <img src={avatarSource} alt="" referrerPolicy="no-referrer" /> : initials}
        </span>
        <span className="mn-topbar-user-name">{displayName}</span>
        <ChevronDown size={14} aria-hidden="true" className={`acw-trigger-chevron${open ? " acw-trigger-chevron-open" : ""}`} />
      </button>

      {open
        ? createPortal(
            <div className={`acw-root${isDesktop ? " acw-popover" : " acw-sheet-mount"}`} data-testid="acw-root">
              {!isDesktop ? (
                <div
                  className="acw-backdrop"
                  aria-hidden="true"
                  onClick={() => setOpen(false)}
                  data-testid="acw-backdrop"
                />
              ) : null}
              <div
                ref={panelRef}
                id={titleId}
                className={`acw-panel${isDesktop ? "" : " acw-panel-sheet"}`}
                role="dialog"
                aria-modal={!isDesktop}
                aria-labelledby={`${titleId}-title`}
                tabIndex={-1}
                data-testid="acw-panel"
                style={
                  isDesktop && anchor ? { top: anchor.top, right: anchor.right, left: "auto", bottom: "auto" } : undefined
                }
              >
                <div className="acw-header">
                  <span className="acw-header-avatar" aria-hidden="true">
                    {avatarSource ? <img src={avatarSource} alt="" referrerPolicy="no-referrer" /> : initials}
                  </span>
                  <div className="acw-header-text">
                    <strong id={`${titleId}-title`} className="acw-header-name">
                      {displayName}
                    </strong>
                    <span className="acw-header-email">{user.email}</span>
                    <span className="acw-header-role">
                      <ShieldCheck size={12} aria-hidden="true" />
                      {formattedRole}
                    </span>
                  </div>
                  <button type="button" className="acw-close" onClick={() => setOpen(false)} aria-label="Close account menu">
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                {!online ? (
                  <div className="acw-offline" role="status" data-testid="acw-offline">
                    <WifiOff size={14} aria-hidden="true" />
                    Offline — profile and sign-out actions may fail.
                  </div>
                ) : (
                  <div className="acw-workspace" data-testid="acw-workspace">
                    <Wifi size={14} aria-hidden="true" />
                    <span>
                      <strong>{workspaceLabel}</strong>
                      <small>Active workspace · bound to your sign-in</small>
                    </span>
                  </div>
                )}

                <div className="acw-scroll">
                  <div className="acw-section">
                    <SectionTitle>Appearance</SectionTitle>
                    <ThemeSegmented />
                  </div>

                  <div className="acw-section">
                    <SectionTitle>Account</SectionTitle>
                    {items
                      .filter((item) => item.show !== false)
                      .map((item) => (
                        <DrawerLink key={item.href ?? item.label} item={{ ...item, onNavigate: closeTo(item.onNavigate) }} />
                      ))}
                  </div>

                  {canOpenWorkspaceSettings ? (
                    <div className="acw-section">
                      <SectionTitle>Workspace</SectionTitle>
                      <DrawerLink
                        item={{
                          label: "Settings",
                          description: "Workspace preferences and configuration",
                          href: workspaceSettingsHref,
                          icon: <Settings size={16} />,
                          onNavigate: closeTo(),
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="acw-section">
                    <SectionTitle>Support</SectionTitle>
                    <DrawerLink
                      item={{
                        label: "Help center",
                        description: "Guides, pricing and resources",
                        href: "/get-started",
                        icon: <LifeBuoy size={16} />,
                        onNavigate: closeTo(),
                      }}
                    />
                    <DrawerLink
                      item={{
                        label: "Contact support",
                        description: "Talk to the MylesNet team",
                        href: "/contact",
                        icon: <Users size={16} />,
                        onNavigate: closeTo(),
                      }}
                    />
                  </div>
                </div>

                <div className="acw-footer">
                  {signOutError ? (
                    <p className="acw-signout-error" role="alert">
                      {signOutError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="acw-signout"
                    onClick={() => setConfirmSignOut(true)}
                    disabled={signingOut}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Remount on every open so the editor always starts from the latest
          reactive Convex profile, including a just-uploaded photo. */}
      {profileOpen ? <UserProfileModal isOpen onClose={() => setProfileOpen(false)} /> : null}

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={() => void handleSignOut()}
        title="Sign out of MylesNet?"
        description="You will need to sign in again to continue working."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        loading={signingOut}
      />
    </>
  );
}

function ThemeSegmented() {
  const [mode, setMode] = useState<ThemeMode | null>(() => {
    if (typeof window === "undefined") return null;
    return readStoredThemeMode();
  });
  const resolved: ResolvedTheme = mode === null ? "light" : resolveThemeMode(mode);

  useEffect(() => {
    const onChange = (event: Event) => {
      setMode((event as CustomEvent<ThemeMode>).detail);
    };
    window.addEventListener("mylesnet-theme-changed", onChange);
    return () => window.removeEventListener("mylesnet-theme-changed", onChange);
  }, []);

  const options: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
    { value: "light", label: "Light", icon: <Sun size={14} aria-hidden="true" /> },
    { value: "dark", label: "Dark", icon: <Moon size={14} aria-hidden="true" /> },
    { value: "system", label: "System", icon: <Laptop size={14} aria-hidden="true" /> },
  ];

  return (
    <div className="acw-theme" role="radiogroup" aria-label="Appearance theme" data-testid="acw-theme">
      {options.map((option) => {
        const selected = (mode ?? "system") === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`acw-theme-option${selected ? " acw-theme-option-selected" : ""}`}
            data-testid={`acw-theme-${option.value}`}
            onClick={() => {
              setThemeMode(option.value);
              setMode(option.value);
            }}
          >
            {option.icon}
            <span>{option.label}</span>
            {selected && option.value === "system" ? <small className="acw-theme-resolved">({resolved})</small> : null}
          </button>
        );
      })}
    </div>
  );
}

