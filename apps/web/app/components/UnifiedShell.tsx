"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { Activity, Building2, CreditCard, Cpu, FileCode, Flag, HeartPulse, LayoutDashboard, LogOut, Menu, Radio, ScrollText, ServerCog, ShieldCheck, TicketCheck, Users, UsersRound, X } from "lucide-react";
import { useConvexAuth } from "@/app/lib/convex";
import { UserProfileProvider, useUserProfile } from "./UserProfileContext";
import { ThemeToggle } from "./ThemeToggle";

const tenantLinks = [
  { href: "/dashboard", label: "Tenant workspace", icon: LayoutDashboard },
  { href: "/admin", label: "Tenant admin", icon: UsersRound },
];

const platformLinks = [
  { href: "/platform", label: "Overview", icon: Activity, exact: true },
  { href: "/platform/tenants", label: "Tenants", icon: Building2 },
  { href: "/platform/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/platform/access", label: "Access & roles", icon: Users },
  { href: "/platform/audit", label: "Audit log", icon: ScrollText },
  { href: "/platform/security", label: "Security", icon: ShieldCheck },
  { href: "/platform/provisioning", label: "Provisioning", icon: ServerCog },
  { href: "/platform/infrastructure/devices", label: "Device fleet", icon: Cpu },
  { href: "/platform/infrastructure/health", label: "Network health", icon: HeartPulse },
  { href: "/platform/infrastructure/policy-templates", label: "Policy templates", icon: FileCode },
  { href: "/platform/infrastructure/radius", label: "RADIUS fleet", icon: Radio },
  { href: "/platform/vouchers/monitor", label: "Voucher monitor", icon: TicketCheck },
  { href: "/platform/feature-flags", label: "Feature flags", icon: Flag },
];

function isLinkActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function ProductNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useUserProfile();
  const showPlatformSurface = user?.isPlatform === true;

  return (
    <nav className="product-nav" aria-label="MylesNet product navigation">
      <p className="product-nav-section">Core</p>
      <Link href="/platform" className={showPlatformSurface && pathname === "/platform" ? "product-nav-link" : isLinkActive(pathname, "/platform") ? "product-nav-link product-nav-link-active" : "product-nav-link"} onClick={onNavigate}>
        <ShieldCheck size={17} aria-hidden="true" /><span>Platform</span>
      </Link>
      {showPlatformSurface ? (
        <div className="product-nav-sub" role="group" aria-label="Platform control plane">
          {platformLinks.map(({ href, label, icon: Icon, exact }) => (
            <Link key={href} href={href} className={isLinkActive(pathname, href, exact) ? "product-nav-sub-link product-nav-sub-link-active" : "product-nav-sub-link"} onClick={onNavigate}>
              <Icon size={15} aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <p className="product-nav-section">Tenant</p>
      {tenantLinks.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={isLinkActive(pathname, href) ? "product-nav-link product-nav-link-active" : "product-nav-link"} onClick={onNavigate}>
          <Icon size={17} aria-hidden="true" /><span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function ProductShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { user, isLoading: userLoading } = useUserProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPublic = pathname === "/signin" || pathname === "/no-access";

  useEffect(() => {
    if (!isPublic && !authLoading && !isAuthenticated) router.replace("/signin");
  }, [authLoading, isAuthenticated, isPublic, router]);

  if (isPublic) return <>{children}</>;
  if (authLoading || userLoading || !user) return <div className="product-loading"><div className="loading-panel workspace-card">Loading MylesNet workspace…</div></div>;

  const leave = async () => { await signOut({ returnTo: window.location.origin }); router.replace("/signin"); };
  return <div className="product-shell"><header className="product-header"><Link href="/dashboard" className="product-brand" aria-label="MylesNet home"><span className="product-brand-mark">M</span><span>MylesNet</span></Link><button type="button" className="product-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="product-header-actions"><span className="product-user-label">{user.name || user.email || "Workspace user"}</span><ThemeToggle /><button type="button" className="product-signout" onClick={() => void leave()}><LogOut size={16} aria-hidden="true" />Sign out</button></div></header><div className="product-body"><aside className="product-sidebar"><ProductNavigation /></aside><main className="product-main">{children}</main></div>{mobileOpen ? <div className="product-mobile-overlay" role="presentation" onMouseDown={() => setMobileOpen(false)}><aside className="product-mobile-panel" onMouseDown={(event) => event.stopPropagation()}><div className="product-mobile-head"><strong>MylesNet</strong><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div><ProductNavigation onNavigate={() => setMobileOpen(false)} /></aside></div> : null}</div>;
}

export function UnifiedShell({ children }: { children: ReactNode }) { return <UserProfileProvider><ProductShellContent>{children}</ProductShellContent></UserProfileProvider>; }
