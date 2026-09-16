import type { NavGroup } from "@mylesnet/ui";
import { CreditCard, LayoutDashboard, Receipt, Settings2, Ticket, TicketCheck, Users, UsersRound, Wallet } from "lucide-react";

/** Tenant billing workspace navigation. Network monitoring is intentionally not part of this product surface. */
export const webNavGroups: NavGroup[] = [
  { id: "overview", label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  { id: "subscribers", label: "Subscribers", items: [{ href: "/subscribers", label: "Subscribers", icon: Users }] },
  { id: "billing", label: "Billing", items: [
    { href: "/revenue", label: "Payments", icon: CreditCard },
    { href: "/expenses", label: "Expenses", icon: Wallet },
    { href: "/plans", label: "Plans", icon: Receipt },
  ] },
  { id: "sales", label: "Sales", items: [
    { href: "/vouchers", label: "Vouchers", icon: TicketCheck },
    { href: "/agents", label: "Agents", icon: UsersRound },
  ] },
  { id: "support", label: "Support", items: [{ href: "/tickets", label: "Tickets", icon: Ticket }] },
];

export const accountNavGroups: NavGroup[] = [
  { id: "settings", label: "Settings", items: [{ href: "/settings", label: "Settings", icon: Settings2 }] },
];
