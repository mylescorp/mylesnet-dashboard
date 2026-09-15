import type { NavGroup } from "@mylesnet/ui";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Ticket,
  Wifi,
  Router,
  HardDrive,
  Map,
  CreditCard,
  Receipt,
  Wallet,
  TicketCheck,
  UsersRound,
  MessageSquare,
  Megaphone,
  BarChart3,
  FileText,
  Settings2,
  ShieldCheck,
  CreditCard as SubscriptionIcon,
  User,
  MessageCircle,
  Star,
} from "lucide-react";

/**
 * Navigation registry for apps/web (Tenant Client Portal).
 * Based on Section 4.2 content mapped to actual routes.
 * Routes that don't exist yet are marked as planned.
 */
export const webNavGroups: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      {
        href: "/subscribers",
        label: "Subscribers",
        icon: Users,
      },
      {
        href: "/prospects",
        label: "Leads",
        icon: UserPlus,
        planned: true,
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    items: [
      {
        href: "/tickets",
        label: "Tickets",
        icon: Ticket,
      },
    ],
  },
  {
    id: "network",
    label: "Network",
    items: [
      {
        href: "/network",
        label: "Live Sessions",
        icon: Wifi,
      },
      {
        href: "/plans",
        label: "Plans",
        icon: TicketCheck,
      },
    ],
  },
  {
    id: "devices",
    label: "Devices",
    items: [
      {
        href: "/devices",
        label: "Routers / NAS",
        icon: Router,
      },
      {
        href: "/devices",
        label: "Equipment",
        icon: HardDrive,
        planned: true,
      },
    ],
  },
  {
    id: "fiber",
    label: "Fiber",
    items: [
      {
        href: "/map",
        label: "Fiber Map",
        icon: Map,
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        href: "/revenue",
        label: "Payments",
        icon: CreditCard,
      },
      {
        href: "/revenue",
        label: "Invoices",
        icon: Receipt,
        planned: true,
      },
      {
        href: "/expenses",
        label: "Expenses",
        icon: Wallet,
      },
    ],
  },
  {
    id: "vouchers",
    label: "Vouchers",
    items: [
      {
        href: "/vouchers",
        label: "Vouchers",
        icon: TicketCheck,
      },
      {
        href: "/vouchers",
        label: "Voucher Sales",
        icon: CreditCard,
        planned: true,
      },
      {
        href: "/vouchers",
        label: "Voucher Batches",
        icon: Wallet,
        planned: true,
      },
      {
        href: "/agents",
        label: "Agents",
        icon: UsersRound,
      },
    ],
  },
  {
    id: "outreach",
    label: "Outreach",
    items: [
      {
        href: "/comms",
        label: "WhatsApp",
        icon: MessageSquare,
      },
      {
        href: "/comms",
        label: "SMS",
        icon: MessageCircle,
        planned: true,
      },
      {
        href: "/comms",
        label: "Message Campaigns",
        icon: Megaphone,
        planned: true,
      },
      {
        href: "/comms",
        label: "Promo Campaigns",
        icon: Star,
        planned: true,
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
      },
      {
        href: "/analytics",
        label: "Changelog",
        icon: FileText,
        planned: true,
      },
    ],
  },
];

/**
 * Account/settings navigation for the tenant portal.
 */
export const accountNavGroups: NavGroup[] = [
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        href: "/settings",
        label: "General",
        icon: Settings2,
      },
      {
        href: "/settings",
        label: "Security",
        icon: ShieldCheck,
        planned: true,
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      {
        href: "/settings",
        label: "Subscription",
        icon: SubscriptionIcon,
        planned: true,
      },
      {
        href: "/settings",
        label: "Payment Methods",
        icon: CreditCard,
        planned: true,
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      {
        href: "/settings",
        label: "Staff",
        icon: Users,
        planned: true,
      },
      {
        href: "/settings",
        label: "Roles",
        icon: ShieldCheck,
        planned: true,
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      {
        href: "/settings",
        label: "Profile",
        icon: User,
        planned: true,
      },
      {
        href: "/settings",
        label: "Preferences",
        icon: Settings2,
        planned: true,
      },
    ],
  },
];