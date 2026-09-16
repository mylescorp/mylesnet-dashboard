import {
  Activity,
  Building2,
  ChartColumn,
  Cpu,
  CreditCard,
  FileCode,
  Flag,
  HandCoins,
  HeartPulse,
  LayoutDashboard,
  Map,
  MessageSquare,
  Package,
  Radio,
  RefreshCw,
  Router,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Ticket,
  TicketCheck,
  UserCog,
  UserSearch,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { NavModule, NavViewBinding } from "@mylesnet/ui";
import { buildNavGroups, buildRouteIndex } from "@mylesnet/ui";

/**
 * Apps/web navigation registry — modules keyed by id, permissions wired
 * through the shared `can()` wrapper. The platform control plane is a
 * separate module; view bindings ensure the /platform sidebar shows
 * only platform content (fixing the former tenant-nav leak).
 */

const platformModule: NavModule = {
  id: "platform",
  label: "Platform",
  permission: "platform",
  items: [
    { href: "/platform", label: "Overview", icon: Activity, exact: true },
    { href: "/platform/tenants", label: "Tenants", icon: Building2 },
    { href: "/platform/subscriptions", label: "Subscriptions", icon: CreditCard },
    { href: "/platform/access", label: "Access & roles", icon: Users },
    { href: "/platform/audit", label: "Audit log", icon: ScrollText },
    { href: "/platform/security", label: "Security", icon: ShieldCheck },
    { href: "/platform/provisioning", label: "Provisioning", icon: ServerCog },
    { href: "/platform/infrastructure/devices", label: "Device fleet", icon: Cpu },
    { href: "/platform/infrastructure/firmware", label: "Firmware rollout", icon: RefreshCw },
    { href: "/platform/infrastructure/health", label: "Network health", icon: HeartPulse },
    { href: "/platform/infrastructure/policy-templates", label: "Policy templates", icon: FileCode },
    { href: "/platform/infrastructure/radius", label: "RADIUS fleet", icon: Radio },
    { href: "/platform/vouchers/monitor", label: "Voucher monitor", icon: TicketCheck },
    { href: "/platform/feature-flags", label: "Feature flags", icon: Flag },
  ],
};

const workspaceModules: NavModule[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin", label: "Tenant admin", icon: UsersRound },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { href: "/subscribers", label: "Subscribers", icon: Users },
      { href: "/prospects", label: "Leads", icon: UserSearch },
    ],
  },
  {
    id: "tickets",
    label: "Tickets",
    items: [{ href: "/tickets", label: "Tickets", icon: TicketCheck }],
  },
  {
    id: "network",
    label: "Network",
    items: [
      { href: "/network", label: "Network operations", icon: Radio },
      { href: "/plans", label: "Plans", icon: Package },
    ],
  },
  {
    id: "devices",
    label: "Devices",
    items: [{ href: "/devices", label: "Routers / NAS", icon: Router }],
  },
  {
    id: "fiber",
    label: "Fiber",
    items: [{ href: "/map", label: "Fiber map", icon: Map }],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { href: "/revenue", label: "Revenue", icon: Wallet },
      { href: "/expenses", label: "Expenses", icon: HandCoins },
    ],
  },
  {
    id: "vouchers",
    label: "Vouchers",
    items: [
      { href: "/vouchers", label: "Vouchers", icon: Ticket },
      { href: "/agents", label: "Agents", icon: UserCog },
    ],
  },
  {
    id: "outreach",
    label: "Outreach",
    items: [{ href: "/comms", label: "Communications", icon: MessageSquare }],
  },
  {
    id: "insights",
    label: "Insights",
    items: [{ href: "/analytics", label: "Analytics", icon: ChartColumn }],
  },
];

export const allModules: NavModule[] = [...workspaceModules, platformModule];

export const viewBindings: NavViewBinding[] = [
  { prefix: "/platform", moduleIds: ["platform"] },
];

/**
 * Build sidebar groups — when the pathname is under /platform, only
 * platform modules appear; tenant routes show workspace modules only.
 * The `can()` wrapper handles RBAC at the shared layer.
 */
export function productNavGroups(
  showPlatform: boolean,
  pathname?: string,
) {
  return buildNavGroups(allModules, {
    can: (p) => (p === "platform" ? showPlatform : true),
    pathname,
    viewBindings,
  });
}

/** Flattened route index for the topbar global search (Cmd/Ctrl+K). */
export function productRouteIndex(showPlatform: boolean) {
  return buildRouteIndex(allModules, {
    can: (p) => (p === "platform" ? showPlatform : true),
  });
}

export { findActiveNavItem } from "@mylesnet/ui";
