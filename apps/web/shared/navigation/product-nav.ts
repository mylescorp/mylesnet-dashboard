import { Activity, Building2, ChartColumn, CreditCard, Database, Flag, HandCoins, LayoutDashboard, KeyRound, Map, Package, Radio, Router, ScrollText, Settings, ShieldCheck, Ticket, TicketCheck, Trophy, UserCog, UserSearch, Users, UsersRound } from "lucide-react";
import type { NavGroup, NavItem, RouteIndexItem } from "@mylesnet/ui";
import { findActiveNavItem } from "@mylesnet/ui";
import { hasPanelAccess, type ProtectedPanel } from "@/shared/auth/panelAccess";

/** Presentation registry only. Server layouts and Convex remain authoritative. */
export type ShellPanel = "platform" | "dashboard" | "admin" | "reseller" | "agency" | "partner";
export type ShellPrincipal = { isPlatform: boolean; roles: Array<{ slug: string }>; permissions: string[] };
type RegisteredItem = NavItem & { permission?: string; roles?: string[] };
type RegisteredGroup = { id: string; label: string; items: RegisteredItem[] };

const dashboardGroups: RegisteredGroup[] = [
  { id: "workspace", label: "Workspace", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true, permission: "dashboard:access" }] },
  { id: "customers", label: "Customers", items: [{ href: "/subscribers", label: "Subscribers", icon: Users, permission: "subscriber_snapshots:read" }, { href: "/prospects", label: "Leads", icon: UserSearch, permission: "prospects:read" }] },
  { id: "support", label: "Support", items: [{ href: "/tickets", label: "Tickets", icon: TicketCheck, permission: "tickets:read" }] },
  { id: "network", label: "Network", items: [{ href: "/network", label: "Network operations", icon: Radio, permission: "dashboard:access" }, { href: "/devices", label: "Devices · Sites", icon: Router, permission: "dashboard:access" }, { href: "/map", label: "Fiber map", icon: Map, permission: "dashboard:access" }, { href: "/plans", label: "Plans", icon: Package, permission: "plans:read" }] },
  { id: "billing", label: "Billing", items: [{ href: "/revenue", label: "Payments", icon: CreditCard, permission: "revenue:view" }, { href: "/expenses", label: "Expenses", icon: HandCoins, permission: "expenses:read" }, { href: "/vouchers", label: "Vouchers", icon: Ticket, permission: "vouchers:read" }, { href: "/agents", label: "Agents", icon: UserCog, permission: "agents:read" }] },
  { id: "insights", label: "Insights", items: [{ href: "/insights/analytics", label: "Analytics", icon: ChartColumn, permission: "analytics:read" }] },
];

const panelGroups: Record<Exclude<ShellPanel, "dashboard">, RegisteredGroup[]> = {
platform: [{ id: "platform", label: "Platform", items: [{ href: "/platform", label: "Overview", icon: Activity, exact: true }, { href: "/platform/organizations", label: "Organizations", icon: Building2 }, { href: "/platform/billing/reconciliation", label: "Payment reconciliation", icon: Receipt, roles: ["platform_super_admin", "platform_finance", "platform_ops", "platform_owner", "platform_admin", "finance_manager", "ops_manager"] }, { href: "/platform/agencies", label: "Agencies", icon: UsersRound, roles: ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "finance_manager", "readonly"] }, { href: "/platform/resellers", label: "Resellers", icon: UsersRound, roles: ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "finance_manager", "readonly"] }, { href: "/platform/subscriptions", label: "Subscriptions", icon: CreditCard }, { href: "/platform/billing/plans", label: "Plans & pricing", icon: CreditCard }, { href: "/platform/billing/anomalies", label: "Billing anomalies", icon: Activity, roles: ["platform_super_admin", "platform_finance", "platform_ops", "platform_owner", "platform_admin", "finance_manager", "ops_manager"] }, { href: "/platform/commissions", label: "Commissions", icon: HandCoins, roles: ["platform_super_admin", "platform_finance", "platform_ops", "platform_owner", "platform_admin", "finance_manager", "ops_manager"] }, { href: "/platform/commissions/rates", label: "Commission rates", icon: HandCoins, roles: ["platform_super_admin", "platform_finance", "platform_owner", "platform_admin", "finance_manager"] }, { href: "/platform/commissions/payouts", label: "Payouts", icon: HandCoins, roles: ["platform_super_admin", "platform_finance", "platform_owner", "platform_admin", "finance_manager"] }, { href: "/platform/analytics", label: "Platform analytics", icon: ChartColumn, roles: ["platform_super_admin", "platform_finance", "platform_ops", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "finance_manager", "readonly", "org-platform_owner", "org-platform_admin"] }, { href: "/platform/analytics/leaderboard", label: "Tenant leaderboard", icon: Trophy, roles: ["platform_super_admin", "platform_readonly", "platform_owner", "platform_admin", "readonly"] }, { href: "/platform/infrastructure/devices", label: "Device fleet", icon: Router, roles: ["platform_super_admin", "platform_ops", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "readonly"] }, { href: "/platform/infrastructure/radius", label: "RADIUS fleet", icon: Radio, roles: ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "finance_manager", "readonly"] }, { href: "/platform/infrastructure/provisioning-queue", label: "Provisioning queue", icon: Radio, roles: ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "finance_manager", "readonly"] }, { href: "/platform/infrastructure/health", label: "Device health", icon: Activity, roles: ["platform_super_admin", "platform_ops", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "readonly"] }, { href: "/platform/infrastructure/policy-templates", label: "Policy templates", icon: Router }, { href: "/platform/vouchers/packages", label: "Voucher packages", icon: Package }, { href: "/platform/support", label: "Support queue", icon: TicketCheck }, { href: "/platform/support/sla", label: "Support SLAs", icon: TicketCheck }, { href: "/platform/access", label: "Access & roles", icon: Users, permission: "users:read" }, { href: "/platform/users/directory", label: "User directory", icon: UserSearch }, { href: "/platform/audit", label: "Audit log", icon: ScrollText, permission: "audit_log:read" }, { href: "/platform/security", label: "Security", icon: ShieldCheck }, { href: "/platform/api-keys", label: "Platform API keys", icon: KeyRound, roles: ["platform_super_admin", "platform_ops", "platform_owner", "platform_admin", "ops_manager"] }, { href: "/platform/security/data-requests", label: "Data requests", icon: Database, roles: ["platform_super_admin", "platform_owner", "platform_admin", "platform_support"] }, { href: "/platform/settings/white-label", label: "White-label defaults", icon: Settings, roles: ["platform_super_admin", "platform_owner", "platform_admin"] }, { href: "/platform/vouchers/monitor", label: "Voucher monitor", icon: TicketCheck, roles: ["platform_super_admin", "platform_ops", "platform_finance", "platform_owner", "platform_admin", "ops_manager", "finance_manager"] }, { href: "/platform/feature-flags", label: "Feature flags", icon: Flag }] }],
  admin: [{ id: "administration", label: "Administration", items: [{ href: "/admin", label: "Tenant administration", icon: UsersRound, exact: true }] }],
  reseller: [{ id: "reseller", label: "Reseller", items: [{ href: "/reseller", label: "Reseller workspace", icon: UsersRound, exact: true }] }],
  agency: [{ id: "agency", label: "Agency", items: [{ href: "/agency", label: "Agency workspace", icon: Building2, exact: true }] }],
  partner: [{ id: "partner", label: "Partner", items: [{ href: "/partner", label: "Partner workspace", icon: Building2, exact: true }] }],
};

export function panelForPathname(pathname: string, principal?: ShellPrincipal, preferredPanel?: string | null): ShellPanel {
  if (pathname === "/account" || pathname.startsWith("/account/") || pathname === "/accounts" || pathname.startsWith("/accounts/")) {
    if (principal && isShellPanel(preferredPanel) && canUsePanel(principal, preferredPanel)) return preferredPanel;
    if (principal?.isPlatform) return "platform";
    if (principal && canUsePanel(principal, "dashboard")) return "dashboard";
    for (const panel of ["admin", "reseller", "agency", "partner"] as const) {
      if (principal && canUsePanel(principal, panel)) return panel;
    }
  }
  if (pathname === "/platform" || pathname.startsWith("/platform/")) return "platform";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/reseller" || pathname.startsWith("/reseller/")) return "reseller";
  if (pathname === "/agency" || pathname.startsWith("/agency/")) return "agency";
  if (pathname === "/partner" || pathname.startsWith("/partner/")) return "partner";
  return "dashboard";
}

function isShellPanel(panel: string | null | undefined): panel is ShellPanel {
  return panel === "platform" || panel === "dashboard" || panel === "admin" || panel === "reseller" || panel === "agency" || panel === "partner";
}

function canUsePanel(principal: ShellPrincipal, panel: ShellPanel): boolean {
  if (panel === "platform") return principal.isPlatform;
  if (principal.isPlatform) return false;
  const roles = principal.roles.map((role) => role.slug);
  if (panel === "dashboard") return hasPanelAccess(roles, "dashboard");
  if (panel === "agency" && process.env.NEXT_PUBLIC_ENABLE_AGENCY_PANEL !== "true") return false;
  if (panel === "partner" && process.env.NEXT_PUBLIC_ENABLE_PARTNER_PANEL !== "true") return false;
  return hasPanelAccess(roles, panel as ProtectedPanel);
}

/** Only routes in the active panel and granted to the signed-in user are rendered or searchable. */
export function productNavGroups(principal: ShellPrincipal, pathname: string, preferredPanel?: string | null): NavGroup[] {
  const panel = panelForPathname(pathname, principal, preferredPanel);
  if (!canUsePanel(principal, panel)) return [];
  const groups = panel === "dashboard" ? dashboardGroups : panelGroups[panel];
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => (!item.permission || principal.permissions.includes(item.permission)) && (!item.roles || item.roles.some((role) => principal.roles.some((principalRole) => principalRole.slug === role)))) })).filter((group) => group.items.length > 0);
}

export function productRouteIndex(groups: NavGroup[]): RouteIndexItem[] {
  return groups.flatMap((group) => group.items.map((item) => ({ href: item.href, label: item.label, group: group.label })));
}

export function panelHome(panel: ShellPanel): string { return panel === "dashboard" ? "/dashboard" : `/${panel}`; }
export { findActiveNavItem };
