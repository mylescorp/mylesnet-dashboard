import { makeFunctionReference } from "convex/server";

export type PlanKind = "data" | "tv" | "home_bundle";

export function planKindLabel(kind: PlanKind): string {
  return kind === "data" ? "Data" : kind === "tv" ? "TV" : "Home Bundle";
}

export type LiveSession = {
  id: string;
  accountNumber: string;
  name: string;
  username: string | null;
  phone: string;
  ipAddress: string | null;
  macAddress: string | null;
  connectionType: "pppoe" | "hotspot";
  currency: string;
  walletBalance: number;
  plan: { name: string; category: PlanKind; priceLocal: number; currency: string } | null;
  expiryDate: number | null;
  daysRemaining: number | null;
  lastSeen: number;
};

export type LiveSessionsResult = {
  sessions: LiveSession[];
  stats: { totalLive: number; byConnectionType: { pppoe: number; hotspot: number }; atRiskSoon: number };
};

export type SiteSummary = {
  id: string;
  name: string;
  country: string;
  currency: string;
  lifecycleStatus: "planned" | "active" | "paused" | "decommissioned";
  status: string;
  coordinates: { lat: number; lng: number } | null;
  installDate: string | null;
  airtelPlanMbps: number | null;
  createdAt: number;
  planCount: number;
  clientCount: number;
  activeClientCount: number;
  revenue: number;
  revenue30d: number;
  openTickets: number;
  expenseTotal: number;
};

export type SiteDetail = {
  site: {
    id: string;
    name: string;
    country: string;
    currency: string;
    lifecycleStatus: string;
    status: string;
    createdAt: number;
    updatedAt: number;
    coordinates: { lat: number; lng: number } | null;
    installDate: string | null;
    airtelPlanMbps: number | null;
    notes: string | null;
  };
  summary: { planCount: number; clientCount: number; activeClientCount: number; revenue: number };
  plans: { id: string; code: string; name: string; category: PlanKind; priceLocal: number; currency: string; durationLabel: string | null }[];
  clients: { id: string; accountNumber: string; name: string; username: string | null; phone: string; ipAddress: string | null; macAddress: string | null; connectionType: "pppoe" | "hotspot"; status: string; currency: string; walletBalance: number; expiryDate: number | null; isLive: boolean; daysRemaining: number | null; planName: string | null; planCategory: PlanKind | null }[];
  payments: { id: string; amount: number; currency: string; gateway: string; reference: string; status: string; paymentDate: number; idSuffix: string | null }[];
  invoices: { id: string; invoiceNumber: string; status: string; currency: string; total: number; subtotal: number; tax: number; discount: number; dueDate: number | null; paidDate: number | null; createdAt: number }[];
  tickets: { id: string; subject: string; status: string; priority: string; createdAt: number }[];
  expenses: { id: string; category: string; amountLocal: number; amountUSD: number; currency: string; type: "fixed" | "variable"; month: string; enteredAt: number }[];
  audit: { id: string; action: string; entityTable: string; entityId: string; beforeJson: string | null; afterJson: string | null; timestamp: number; changedBy: string }[];
};

export const networkOps = {
  listLiveSessions: makeFunctionReference<"query", Record<string, never>, LiveSessionsResult>("networkOps:listLiveSessions"),
  listSites: makeFunctionReference<"query", Record<string, never>, SiteSummary[]>("networkOps:listSites"),
  getSiteDetail: makeFunctionReference<"query", { siteId: string }, SiteDetail | null>("networkOps:getSiteDetail"),
};