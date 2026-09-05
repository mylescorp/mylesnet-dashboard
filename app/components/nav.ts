import {
  Activity,
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Cog,
  CreditCard,
  Download,
  FileDiff,
  History,
  LayoutDashboard,
  Map,
  MapPinned,
  Megaphone,
  Monitor,
  RadioTower,
  Settings2,
  ShieldCheck,
  ShieldPlus,
  Ticket,
  Trash2,
  TriangleAlert,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The permission slug required to see this entry. */
  permission: string;
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        permission: "dashboard:access",
      },
    ],
  },
  {
    title: "Routers & Network",
    items: [
      {
        href: "/routers",
        label: "Router estate",
        icon: RadioTower,
        permission: "routers:read",
      },
      {
        href: "/console",
        label: "Console",
        icon: Monitor,
        permission: "routers:manage",
      },
      {
        href: "/devices",
        label: "Devices & access points",
        icon: Boxes,
        permission: "devices:read",
      },
      {
        href: "/collector-setup",
        label: "Collector setup",
        icon: Cog,
        permission: "collector:manage",
      },
      {
        href: "/config-watch",
        label: "Config watch",
        icon: FileDiff,
        permission: "config_watch:manage",
      },
      {
        href: "/telemetry-health",
        label: "Telemetry health",
        icon: Activity,
        permission: "telemetry_health:read",
      },
      {
        href: "/incidents",
        label: "Incident & alert desk",
        icon: TriangleAlert,
        permission: "incidents:read",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/shift-notes",
        label: "Shift handover",
        icon: ClipboardList,
        permission: "shift_notes:manage",
      },
      {
        href: "/tickets",
        label: "Support tickets",
        icon: Ticket,
        permission: "tickets:read",
      },
    ],
  },
  {
    title: "Field Operations",
    items: [
      {
        href: "/markets",
        label: "Markets",
        icon: Map,
        permission: "markets:read",
      },
      {
        href: "/prospects",
        label: "Prospects",
        icon: MapPinned,
        permission: "prospects:read",
      },
      {
        href: "/agents",
        label: "Agents",
        icon: Users,
        permission: "agents:read",
      },
      {
        href: "/leaderboard",
        label: "Leaderboard",
        icon: Trophy,
        permission: "leaderboard:read",
      },
    ],
  },
  {
    title: "Billing & Revenue",
    items: [
      {
        href: "/business-activity",
        label: "Business events",
        icon: BarChart3,
        permission: "business_events:read",
      },
      {
        href: "/vouchers",
        label: "Voucher stock",
        icon: CreditCard,
        permission: "vouchers:read",
      },
      {
        href: "/commissions",
        label: "Commissions",
        icon: CircleDollarSign,
        permission: "commissions:read",
      },
      {
        href: "/usage",
        label: "Usage reports",
        icon: Download,
        permission: "usage:read",
      },
    ],
  },
  {
    title: "System & Administration",
    items: [
      {
        href: "/access",
        label: "Access management",
        icon: ShieldPlus,
        permission: "users:manage",
      },
      {
        href: "/audit-log",
        label: "Audit log",
        icon: History,
        permission: "audit_log:read",
      },
      {
        href: "/comms",
        label: "Comms",
        icon: Megaphone,
        permission: "comms:manage",
      },
      {
        href: "/centipid",
        label: "Centipid",
        icon: Settings2,
        permission: "centipid:manage",
      },
      {
        href: "/trash",
        label: "Trash",
        icon: Trash2,
        permission: "trash:manage",
      },
      {
        href: "/compliance",
        label: "Compliance",
        icon: ShieldCheck,
        permission: "compliance:access",
      },
    ],
  },
];

/** Permission-based access check. Empty permission sets deny everything. */
export function canAccess(permissions: ReadonlySet<string> | readonly string[], item: NavItem): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return set.has(item.permission);
}

type MatchKind = "exact" | "prefix" | null;

function matchesItem(pathname: string, item: NavItem): MatchKind {
  if (item.exact) return pathname === item.href ? "exact" : null;
  if (pathname === item.href) return "exact";
  if (pathname.startsWith(item.href + "/")) return "prefix";
  return null;
}

export interface NavEntry {
  section: NavSection;
  item: NavItem;
  isDetail: boolean;
}

/** Finds the nav entry that owns a pathname (exact match preferred, then prefix). */
export function findNavEntry(pathname: string): NavEntry | undefined {
  for (const section of navSections) {
    for (const item of section.items) {
      const match = matchesItem(pathname, item);
      if (match) return { section, item, isDetail: match === "prefix" };
    }
  }
  return undefined;
}