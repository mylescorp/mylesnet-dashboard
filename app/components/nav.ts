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

export type PlatformRole = "platform_owner" | "platform_admin" | "platform_support";
export type OpsRole = "operator" | "agent";
export type NavRole = PlatformRole | OpsRole;

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: NavRole[];
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const PLATFORM: PlatformRole[] = ["platform_owner", "platform_admin", "platform_support"];
const OPERATOR: OpsRole[] = ["operator"];
const AGENT: OpsRole[] = ["agent"];

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: [...OPERATOR, ...PLATFORM, ...AGENT],
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/routers",
        label: "Router estate",
        icon: RadioTower,
        roles: [...OPERATOR, ...PLATFORM],
      },
      {
        href: "/incidents",
        label: "Incident & alert desk",
        icon: TriangleAlert,
        roles: [...OPERATOR, ...PLATFORM],
      },
      {
        href: "/shift-notes",
        label: "Shift handover",
        icon: ClipboardList,
        roles: [...OPERATOR, ...PLATFORM],
      },
      {
        href: "/tickets",
        label: "Support tickets",
        icon: Ticket,
        roles: [...PLATFORM, ...AGENT],
      },
    ],
  },
  {
    title: "Monitoring",
    items: [
      {
        href: "/config-watch",
        label: "Config watch",
        icon: FileDiff,
        roles: [...OPERATOR, ...PLATFORM],
      },
      {
        href: "/collector-setup",
        label: "Collector setup",
        icon: Cog,
        roles: [...OPERATOR, ...PLATFORM],
      },
      {
        href: "/telemetry-health",
        label: "Telemetry health",
        icon: Activity,
        roles: [...OPERATOR, ...PLATFORM],
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
        roles: [...PLATFORM],
      },
      {
        href: "/prospects",
        label: "Prospects",
        icon: MapPinned,
        roles: ["platform_owner", "platform_admin", "platform_support"],
      },
      {
        href: "/devices",
        label: "Devices",
        icon: Boxes,
        roles: [...PLATFORM],
      },
      {
        href: "/agents",
        label: "Agents",
        icon: Users,
        roles: ["platform_owner", "platform_admin"],
      },
      {
        href: "/leaderboard",
        label: "Leaderboard",
        icon: Trophy,
        roles: [...PLATFORM],
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
        roles: [...OPERATOR, ...PLATFORM, ...AGENT],
      },
      {
        href: "/vouchers",
        label: "Voucher stock",
        icon: CreditCard,
        roles: ["platform_owner", "platform_admin"],
      },
      {
        href: "/commissions",
        label: "Commissions",
        icon: CircleDollarSign,
        roles: ["platform_owner", "platform_admin"],
      },
      {
        href: "/usage",
        label: "Usage reports",
        icon: Download,
        roles: [...OPERATOR, ...PLATFORM],
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
        roles: ["platform_owner"],
      },
      {
        href: "/audit-log",
        label: "Audit log",
        icon: History,
        roles: ["platform_owner", "platform_admin"],
      },
      {
        href: "/comms",
        label: "Comms",
        icon: Megaphone,
        roles: ["platform_owner", "platform_admin"],
      },
      {
        href: "/centipid",
        label: "Centipid",
        icon: Settings2,
        roles: ["platform_owner", "platform_admin"],
      },
      {
        href: "/trash",
        label: "Trash",
        icon: Trash2,
        roles: ["platform_owner", "platform_admin"],
      },
      {
        href: "/compliance",
        label: "Compliance",
        icon: ShieldCheck,
        roles: [...OPERATOR, ...PLATFORM, ...AGENT],
      },
    ],
  },
];

export const ALL_NAV_ROLES: NavRole[] = ["platform_owner", "platform_admin", "platform_support", "operator", "agent"];

/** Maps a stored `platformRole` (nullable) to the effective nav role. */
export function effectiveRole(platformRole: string | null | undefined): NavRole {
  return platformRole === "platform_owner" ||
    platformRole === "platform_admin" ||
    platformRole === "platform_support"
    ? platformRole
    : platformRole === "agent"
      ? "agent"
      : "operator";
}

export function canAccess(role: NavRole, item: NavItem): boolean {
  return item.roles.includes(role);
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