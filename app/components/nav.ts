import {
  Activity,
  ArrowDownUp,
  BarChart3,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Coins,
  Cog,
  CreditCard,
  FileBarChart,
  FileDiff,
  FileSpreadsheet,
  Gauge,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  LineChart,
  Map,
  MapPinned,
  Megaphone,
  Monitor,
  Network,
  PieChart,
  RadioTower,
  Receipt,
  Settings2,
  ShieldCheck,
  ShieldPlus,
  SlidersHorizontal,
  Ticket,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Trophy,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The permission slug required to see this entry. */
  permission: string;
  exact?: boolean;
  /** Route may not have a page yet (planned module). */
  planned?: boolean;
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
      {
        href: "/map",
        label: "Market map",
        icon: Map,
        permission: "devices:read",
        planned: true,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/markets",
        label: "Markets",
        icon: MapPinned,
        permission: "markets:read",
      },
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
        href: "/telemetry-health",
        label: "Network health",
        icon: Activity,
        permission: "telemetry_health:read",
      },
      {
        href: "/incidents",
        label: "Alerts & incidents",
        icon: TriangleAlert,
        permission: "incidents:read",
      },
      {
        href: "/maintenance",
        label: "Maintenance",
        icon: Wrench,
        permission: "maintenance:manage",
        planned: true,
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
      {
        href: "/prospects",
        label: "Prospects",
        icon: ArrowDownUp,
        permission: "prospects:read",
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        href: "/business-activity",
        label: "Business events",
        icon: LineChart,
        permission: "business_events:read",
      },
      {
        href: "/revenue",
        label: "Revenue",
        icon: HandCoins,
        permission: "revenue:view",
        planned: true,
      },
      {
        href: "/sales",
        label: "Sales",
        icon: BarChart3,
        permission: "agents:read",
        planned: true,
      },
      {
        href: "/subscribers",
        label: "Subscribers",
        icon: Users,
        permission: "subscriber_snapshots:read",
        planned: true,
      },
      {
        href: "/plans",
        label: "Plans & products",
        icon: CreditCard,
        permission: "plans:read",
        planned: true,
      },
      {
        href: "/profitability",
        label: "Market profitability",
        icon: PieChart,
        permission: "financials:read",
        planned: true,
      },
      {
        href: "/vouchers",
        label: "Voucher stock",
        icon: Ticket,
        permission: "vouchers:read",
      },
    ],
  },
  {
    title: "Performance",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: Gauge,
        permission: "analytics:read",
        planned: true,
      },
      {
        href: "/leaderboard",
        label: "Leaderboards",
        icon: Trophy,
        permission: "leaderboard:read",
      },
      {
        href: "/risk",
        label: "Risk center",
        icon: TriangleAlert,
        permission: "risk_center:read",
        planned: true,
      },
      {
        href: "/capacity",
        label: "Capacity planning",
        icon: TrendingUp,
        permission: "capacity:read",
        planned: true,
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        href: "/agents",
        label: "Agents",
        icon: UserCog,
        permission: "agents:read",
      },
      {
        href: "/teams",
        label: "Teams",
        icon: Users,
        permission: "teams:read",
        planned: true,
      },
      {
        href: "/assignments",
        label: "Assignments",
        icon: CalendarClock,
        permission: "agents:read",
        planned: true,
      },
      {
        href: "/access",
        label: "Roles & permissions",
        icon: ShieldPlus,
        permission: "users:manage",
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        href: "/payouts",
        label: "Payouts",
        icon: HandCoins,
        permission: "payouts:read",
        planned: true,
      },
      {
        href: "/commissions",
        label: "Commissions",
        icon: CircleDollarSign,
        permission: "commissions:read",
      },
      {
        href: "/expenses",
        label: "Expenses",
        icon: Receipt,
        permission: "expenses:read",
        planned: true,
      },
      {
        href: "/profit-loss",
        label: "Profit & loss",
        icon: FileSpreadsheet,
        permission: "financials:read",
        planned: true,
      },
      {
        href: "/investor-reports",
        label: "Investor reports",
        icon: Landmark,
        permission: "investors:read",
        planned: true,
      },
      {
        href: "/currency",
        label: "Currency",
        icon: Coins,
        permission: "financials:read",
        planned: true,
      },
    ],
  },
  {
    title: "Reporting",
    items: [
      {
        href: "/daily-digest",
        label: "Daily digest",
        icon: ClipboardList,
        permission: "reports:read",
        planned: true,
      },
      {
        href: "/scheduled-reports",
        label: "Scheduled reports",
        icon: CalendarClock,
        permission: "reports:read",
        planned: true,
      },
      {
        href: "/usage",
        label: "Export center",
        icon: FileBarChart,
        permission: "usage:read",
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        href: "/site-kit",
        label: "Standard site kit",
        icon: ShieldCheck,
        permission: "site_kit:manage",
        planned: true,
      },
      {
        href: "/comms",
        label: "Notifications & comms",
        icon: Megaphone,
        permission: "comms:manage",
      },
      {
        href: "/integrations",
        label: "Integrations",
        icon: Network,
        permission: "centipid:manage",
        planned: true,
      },
      {
        href: "/centipid",
        label: "Centipid",
        icon: Settings2,
        permission: "centipid:manage",
      },
      {
        href: "/audit-log",
        label: "Audit log",
        icon: History,
        permission: "audit_log:read",
      },
      {
        href: "/compliance",
        label: "Compliance",
        icon: ShieldCheck,
        permission: "compliance:access",
      },
      {
        href: "/trash",
        label: "Trash",
        icon: Trash2,
        permission: "trash:manage",
      },
      {
        href: "/settings",
        label: "System settings",
        icon: SlidersHorizontal,
        permission: "users:manage",
        planned: true,
      },
    ],
  },
];

/** Permission-based access check. Empty permission sets deny everything. */
export function canAccess(permissions: ReadonlySet<string> | readonly string[], item: NavItem): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return set.has(item.permission);
}

export function isNavPlanned(item: NavItem): boolean {
  return item.planned === true;
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