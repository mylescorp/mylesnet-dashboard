import { makeFunctionReference } from "convex/server";

/** Plan summary embedded in the subscriber detail read model. */
export type SubscriberDetailPlan = {
  name: string;
  code: string;
  category: "data" | "tv" | "home_bundle";
  priceLocal: number;
  currency: string;
  durationLabel: string | null;
};

export type SubscriberPayment = {
  _id: string;
  subscriberId?: string;
  invoiceId?: string;
  planId?: string;
  amount: number;
  currency: string;
  gateway: string;
  reference: string;
  status: "pending" | "completed" | "failed" | "refunded";
  paymentDate: number;
  operatorId?: string;
  createdAt: number;
  updatedAt: number;
};

export type SubscriberInvoice = {
  _id: string;
  invoiceNumber: string;
  subscriberId?: string;
  status: "draft" | "issued" | "paid" | "overdue" | "cancelled";
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  dueDate?: number;
  paidDate?: number;
  issuedDate?: number;
  notes?: string;
  operatorId?: string;
  createdAt: number;
  updatedAt: number;
};

export type SubscriberAuditEntry = {
  _id: string;
  action: string;
  entityTable: string;
  entityId: string;
  changedBy: string;
  beforeJson?: string;
  afterJson?: string;
  timestamp: number;
  ip?: string;
  chainSequence?: number;
  prevHash?: string;
  hash?: string;
};

/**
 * Deep subscriber record served by convex/subscriberDetail.ts. Keep in sync
 * with the Convex handler — this explicit reference bypasses the stale
 * generated Convex API.
 */
export type SubscriberDetail = {
  subscriber: {
    _id: string;
    accountNumber: string;
    name: string;
    phone: string;
    email?: string;
    username?: string;
    planId?: string;
    connectionType: "pppoe" | "hotspot";
    status: "active" | "expired" | "suspended" | "disabled" | "at_risk" | "churned";
    expiryDate?: number;
    macAddress?: string;
    ipAddress?: string;
    walletBalance: number;
    currency: string;
    createdAt: number;
    updatedAt: number;
  };
  plan: SubscriberDetailPlan | null;
  payments: SubscriberPayment[];
  invoices: SubscriberInvoice[];
  audit: SubscriberAuditEntry[];
  lifetimeTotal: number;
  lastPayment: SubscriberPayment | null;
  totalPaidCount: number;
};

export const subscriberDetail = {
  getDetail: makeFunctionReference<
    "query",
    { subscriberId: string },
    SubscriberDetail | null
  >("subscriberDetail:getDetail"),
};