import { Activity, Building2, ChartColumn, CreditCard, Flag, HandCoins, LayoutDashboard, Map, Package, Radio, Router, ScrollText, ShieldCheck, Ticket, TicketCheck, UserCog, UserSearch, Users, UsersRound } from "lucide-react";
import type { NavGroup, NavItem, RouteIndexItem } from "@mylesnet/ui";
import { findActiveNavItem } from "@mylesnet/ui";
import { hasPanelAccess, type ProtectedPanel } from "@/shared/auth/panelAccess";

/** Presentation registry only. Server layouts and Convex remain authoritative. */
export type ShellPanel = "platform" | "dashboard" | "admin" | "reseller" | "agency" | "partner";
export type ShellPrincipal = { isPlatform: boolean; roles: Array<{ slug: string }>; permissions: string[] };
type RegisteredItem = NavItem & { permission?: string };
type RegisteredGroup = { id: string; label: string; items: RegisteredItem[] };

const dashboardGroups: RegisteredGroup[] = [
  { id: "workspace", label: "Workspace", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true, permission: "dashboard:access" }] },
  { id: "customers", label: "Customers", items: [{ href: "/subscribers", label: "Subscribers", icon: Users, permission: "subscriber_snapshots:read" }, { href: "/prospects", label: "Leads", icon: UserSearch, permission: "prospects:read" }] },
  { id: "support", label: "Support", items: [{ href: "/tickets", label: "Tickets", icon: TicketCheck, permission: "tickets:read" }] },
  { id: "network", label: "Network", items: [{ href: "/network", label: "Network operations", icon: Radio, permission: "dashboard:access" }, { href: "/devices", label: "Devices · Sites", icon: Router, permission: "dashboard:access" }, { href: "/map", label: "Fiber map", icon: Map, permission: "dashboard:access" }, { href: "/plans", label: "Plans", icon: Package, permission: "plans:read" }] },
  { id: "billing", label: "Billing", items: [{ href: "/revenue", label: "Payments", icon: CreditCard, permission: "revenue:view" }, { href: "/expenses", label: "Expenses", icon: HandCoins, permission: "expenses:read" }, { href: "/vouchers", label: "Vouchers", icon: Ticket, permission: "vouchers:read" }, { href: "/agents", label: "Agents", icon: UserCog, permission: "agents:read" }] },
  { id: "insights", label: "Insights", items: [{ href: "/analytics", label: "Analytics", icon: ChartColumn, permission: "analytics:read" }] },
];

const panelGroups: Record<Exclude<ShellPanel, "dashboard">, RegisteredGroup[]> = {
  platform: [{ id: "platform", label: "Platform", items: [{ href: "/platform", label: "Overview", icon: Activity, exact: true }, { href: "/platform/tenants", label: "Tenants", icon: Building2 }, { href: "/platform/subscriptions", label: "Subscriptions", icon: CreditCard }, { href: "/platform/access", label: "Access & roles", icon: Users, permission: "users:read" }, { href: "/platform/audit", label: "Audit log", icon: ScrollText, permission: "audit_log:read" }, { href: "/platform/security", label: "Security", icon: ShieldCheck }, { href: "/platform/vouchers/monitor", label: "Voucher monitor", icon: TicketCheck, permission: "vouchers:read" }, { href: "/platform/feature-flags", label: "Feature flags", icon: Flag }] }],
  admin: [{ id: "administration", label: "Administration", items: [{ href: "/admin", label: "Tenant administration", icon: UsersRound, exact: true }] }],
  reseller: [{ id: "reseller", label: "Reseller", items: [{ href: "/reseller", label: "Reseller workspace", icon: UsersRound, exact: true }] }],
  agency: [{ id: "agency", label: "Agency", items: [{ href: "/agency", label: "Agency workspace", icon: Building2, exact: true }] }],
  partner: [{ id: "partner", label: "Partner", items: [{ href: "/partner", label: "Partner workspace", icon: Building2, exact: true }] }],
};

export function panelForPathname(pathname: string): ShellPanel {
  if (pathname === "/platform" || pathname.startsWith("/platform/")) return "platform";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/reseller" || pathname.startsWith("/reseller/")) return "reseller";
  if (pathname === "/agency" || pathname.startsWith("/agency/")) return "agency";
  if (pathname === "/partner" || pathname.startsWith("/partner/")) return "partner";
  return "dashboard";
}

function canUsePanel(principal: ShellPrincipal, panel: ShellPanel): boolean {
  if (panel === "platform") return principal.isPlatform;
  if (principal.isPlatform) return false;
  const roles = principal.roles.map((role) => role.slug);
  if (panel === "dashboard") return principal.permissions.includes("dashboard:access") || hasPanelAccess(roles, "dashboard");
  return hasPanelAccess(roles, panel as ProtectedPanel);
}

/** Only routes in the active panel and granted to the signed-in user are rendered or searchable. */
export function productNavGroups(principal: ShellPrincipal, pathname: string): NavGroup[] {
  const panel = panelForPathname(pathname);
  if (!canUsePanel(principal, panel)) return [];
  const groups = panel === "dashboard" ? dashboardGroups : panelGroups[panel];
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || principal.permissions.includes(item.permission)) })).filter((group) => group.items.length > 0);
}

export function productRouteIndex(groups: NavGroup[]): RouteIndexItem[] {
  return groups.flatMap((group) => group.items.map((item) => ({ href: item.href, label: item.label, group: group.label })));
}

export function panelHome(panel: ShellPanel): string { return panel === "dashboard" ? "/dashboard" : `/${panel}`; }
export { findActiveNavItem };
