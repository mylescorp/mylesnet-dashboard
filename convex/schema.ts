import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { provisioningAttemptValidator } from "./lib/signup";

// ==========================================================================
// PHASE 1 — TENANCY & ISOLATION (X-TEN §B1, §B5)
// ==========================================================================

/**
 * Shared tenant-scope field spread into every tenant-owned table (Phase 1,
 * additive migration). Optional during the migration: existing records hold
 * `tenantId: undefined` until the gated `tenantid-backfill-001` run; once the
 * read/write-path enforcement and backfill land, enforcement flips it to
 * required. Client-supplied tenant ids are never authority.
 */
const tenantScope = {
  tenantId: v.optional(v.id("tenants")),
} as const;

export default defineSchema({
  ...authTables,

  users: defineTable({
    // Immutable identity from WorkOS. Optional while legacy Auth records are
    // migrated, then used as the sole authorization lookup key.
    workosUserId: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    jobTitle: v.optional(v.string()),
    profileCompletedAt: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    deactivatedAt: v.optional(v.number()),
    // Optional MFA enrollment mirror for account-security preferences.
    // Synced from WorkOS enrollment at identity reconcile time. A mandatory-2FA
    // role without a marker is non-compliant and server guards fail closed.
    mfaEnrolled: v.optional(v.boolean()),
    mfaEnrolledAt: v.optional(v.number()),
    platformRole: v.optional(
      v.union(
        v.literal("platform_owner"),
        v.literal("platform_admin"),
        v.literal("platform_support"),
        v.literal("agent")
      )
    ),
    // Active role assignments. Authoritative for authorization once the
    // system roles are seeded and users are backfilled. Empty/missing during
    // migration falls back to the `platformRole` mirror.
    roles: v.optional(v.array(v.id("roles"))),
    // Convex file-storage id for the account avatar (resolved to a URL on read).
    avatarStorageId: v.optional(v.string()),
    // Soft delete: removed accounts keep their row (and WorkOS user) but lose
    // all access. Restorable by trash:manage.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    // Persisted workspace scope for the sidebar selector (Section 30 of the
    // NOC spec): survives page refresh without browser storage.
    lastWorkspaceScope: v.optional(
      v.object({
        country: v.optional(v.string()),
        marketId: v.optional(v.id("markets")),
      })
    ),
  })
    .index("email", ["email"])
    .index("by_workosUserId", ["workosUserId"])
    .index("phone", ["phone"])
    .index("by_platformRole", ["platformRole"]),

  // ==========================================================================
  // ROLE-BASED ACCESS CONTROL
  // ==========================================================================

  /** Authoritative role registry. System roles are seeded; custom roles are synced to WorkOS (org-scoped). */
  roles: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isSystem: v.boolean(),
    isPlatform: v.boolean(),
    rank: v.number(),
    permissions: v.array(v.string()),
    workosRoleId: v.optional(v.string()),
    workosRoleSlug: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_slug", ["slug"])
    .index("by_rank", ["rank"]),

  /** Mirror of WorkOS invitations (auto-joined to the platform org). */
  invitations: defineTable({
    workosInvitationId: v.string(),
    email: v.string(),
    roleId: v.optional(v.id("roles")),
    roleSlug: v.optional(v.string()),
    organizationId: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
    invitedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_workosId", ["workosInvitationId"]),

  /** Cache of WorkOS organization memberships for the platform org, synced by webhook. */
  organizationMemberships: defineTable({
    ...tenantScope,
    workosMembershipId: v.string(),
    workosUserId: v.string(),
    organizationId: v.string(),
    roleId: v.optional(v.id("roles")),
    roleSlug: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("pending")),
    syncedAt: v.number(),
  })
    .index("by_membership", ["workosMembershipId"])
    .index("by_user", ["workosUserId"])
    .index("by_org", ["organizationId"]),

  userMarketMemberships: defineTable({
    ...tenantScope,
    userId: v.id("users"),
    marketId: v.id("markets"),
    role: v.union(v.literal("manager"), v.literal("operator"), v.literal("viewer")),
    createdAt: v.number(),
    updatedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_user_and_market", ["userId", "marketId"])
    .index("by_market", ["marketId"]),

  featureFlags: defineTable({
    key: v.string(),
    valueJson: v.string(),
    enabled: v.boolean(),
    description: v.optional(v.string()),
    tenantIds: v.optional(v.array(v.id("tenants"))),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_key", ["key"]),

  subscribers: defineTable({
    ...tenantScope,
    accountNumber: v.string(),
    username: v.optional(v.string()),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.string(),
    planId: v.optional(v.id("plans")),
    connectionType: v.union(v.literal("pppoe"), v.literal("hotspot")),
    status: v.union(v.literal("active"), v.literal("expired"), v.literal("suspended"), v.literal("disabled"), v.literal("at_risk"), v.literal("churned")),
    expiryDate: v.optional(v.number()),
    macAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    walletBalance: v.number(),
    currency: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_account_number", ["accountNumber"])
    .index("by_username", ["username"])
    .index("by_phone", ["phone"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_plan", ["planId"])
    .index("by_expiry", ["expiryDate"]),

  payments: defineTable({
    ...tenantScope,
    subscriberId: v.optional(v.id("subscribers")),
    invoiceId: v.optional(v.id("invoices")),
    planId: v.optional(v.id("plans")),
    amount: v.number(),
    currency: v.string(),
    gateway: v.string(),
    reference: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"), v.literal("refunded")),
    paymentDate: v.number(),
    operatorId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tenant", ["tenantId"]).index("by_subscriber", ["subscriberId"]).index("by_invoice", ["invoiceId"]).index("by_status", ["status"]).index("by_date", ["paymentDate"]),

  invoices: defineTable({
    ...tenantScope,
    invoiceNumber: v.string(),
    subscriberId: v.optional(v.id("subscribers")),
    status: v.union(v.literal("draft"), v.literal("issued"), v.literal("paid"), v.literal("overdue"), v.literal("cancelled")),
    currency: v.string(),
    subtotal: v.number(),
    tax: v.number(),
    discount: v.number(),
    total: v.number(),
    dueDate: v.optional(v.number()),
    paidDate: v.optional(v.number()),
    issuedDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    operatorId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tenant", ["tenantId"]).index("by_subscriber", ["subscriberId"]).index("by_status", ["status"]).index("by_number", ["invoiceNumber"]).index("by_due_date", ["dueDate"]),

  invoiceLineItems: defineTable({
    ...tenantScope,
    invoiceId: v.id("invoices"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    total: v.number(),
    createdAt: v.number(),
  }).index("by_tenant", ["tenantId"]).index("by_invoice", ["invoiceId"]),

  system_settings: defineTable({
    key: v.string(),
    valueJson: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  webhookDeliveryLog: defineTable({
    receivedAt: v.number(),
    eventType: v.string(),
    signatureValid: v.boolean(),
    processed: v.boolean(),
    errorMessage: v.optional(v.string()),
    signatureHeader: v.optional(v.string()),
    rawBodyPreview: v.optional(v.string()),
  }).index("by_receivedAt", ["receivedAt"]),

  /** Durable, idempotent WorkOS delivery inbox. Payloads are short-lived. */
  workosWebhookEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    data: v.any(),
    status: v.union(v.literal("received"), v.literal("completed"), v.literal("retry"), v.literal("quarantined")),
    attempts: v.number(),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    nextAttemptAt: v.optional(v.number()),
    reason: v.optional(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_status", ["status"]),

  // ==========================================================================
  // MASTER ADMIN / PLATFORM (business operations)
  // ==========================================================================

  markets: defineTable({
    ...tenantScope,
    name: v.string(),
    country: v.string(),
    // Widened from a UGX/KSH union: Uganda and Kenya today, spec §22 allows any
    // ISO-4217 code as markets expand.
    currency: v.string(),
    lifecycleStatus: v.union(v.literal("planned"), v.literal("active"), v.literal("paused"), v.literal("decommissioned")),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deleteReason: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    restoredBy: v.optional(v.id("users")),
    // Locality + install/backhaul metadata (spec §22 "MylesNet markets").
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    installDate: v.optional(v.string()),
    airtelPlanMbps: v.optional(v.number()),
    notes: v.optional(v.string()),
    badges: v.optional(v.array(v.string())),
    // Per-market site-kit API key (spec §10 siteKit). Only a SHA-256 hash is
    // ever stored — the raw key is shown once at generation time.
    apiKeyHash: v.optional(v.string()),
    apiKeyCreatedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["status"])
    .index("by_country", ["country"]),

  marketOperatingCosts: defineTable({
    ...tenantScope,
    marketId: v.id("markets"),
    yearMonth: v.string(),
    airtelDataCost: v.number(),
    electricityCost: v.number(),
    currency: v.string(),
    reportedBy: v.id("users"),
    reportedAt: v.number(),
  })
    .index("by_market_month", ["marketId", "yearMonth"])
    .index("by_market", ["marketId"]),

  agents: defineTable({
    ...tenantScope,
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    lifecycleStatus: v.string(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    terminatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deleteReason: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    restoredBy: v.optional(v.id("users")),
    // NOC spec "Agent Management": optional platform account link + default
    // commission model + achievement badges.
    userId: v.optional(v.id("users")),
    commissionModel: v.optional(v.union(v.literal("percentage"), v.literal("flat_per_sale"), v.literal("bonus_based"))),
    badges: v.optional(v.array(v.string())),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_lifecycleStatus", ["lifecycleStatus"])
    .index("by_status", ["status"]),

  agentMarketAssignments: defineTable({
    ...tenantScope,
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    assignmentStatus: v.string(),
    compensationType: v.string(),
    commissionRate: v.number(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    endReason: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_agent", ["agentId"])
    .index("by_agent_status", ["agentId", "assignmentStatus"])
    .index("by_market", ["marketId"]),

  commissions: defineTable({
    ...tenantScope,
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    voucherId: v.optional(v.id("vouchers")),
    amount: v.number(),
    currency: v.string(),
    payoutStatus: v.string(),
    isFinalSettlement: v.boolean(),
    accruedAt: v.number(),
    disputeWindowEndsAt: v.number(),
    payoutMethod: v.optional(
      v.union(
        v.literal("mpesa"),
        v.literal("airtel_money"),
        v.literal("bank_transfer")
      )
    ),
    requestedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["payoutStatus"])
    .index("by_agent", ["agentId"]),

  vouchers: defineTable({
    ...tenantScope,
    batchId: v.id("voucherBatches"),
    marketId: v.id("markets"),
    code: v.string(),
    checksum: v.string(),
    voucherStatus: v.string(),
    expiresAt: v.number(),
    ownerAgentId: v.optional(v.id("agents")),
    soldAt: v.optional(v.number()),
    redeemedAt: v.optional(v.number()),
    customerPhoneAtRedemption: v.optional(v.string()),
    // Redemption forensics (spec F1): identity of the device/IP that redeemed
    // the voucher, plus the fraud-monitor disposition. All optional — legacy
    // and unredeemed vouchers carry no value.
    redeemedDeviceId: v.optional(v.string()),
    redeemedIpAddress: v.optional(v.string()),
    fraudFlagStatus: v.optional(
      v.union(v.literal("clean"), v.literal("flagged"), v.literal("blocked")),
    ),
    fraudFlagReason: v.optional(v.string()),
  })
    .index("by_batch", ["batchId"])
    .index("by_code", ["code"])
    .index("by_status", ["voucherStatus"])
    .index("by_owner", ["ownerAgentId"])
    .index("by_market", ["marketId"]),

  voucherBatches: defineTable({
    ...tenantScope,
    marketId: v.id("markets"),
    planType: v.string(),
    quantity: v.number(),
    currency: v.string(),
    priceEach: v.number(),
    generatedBy: v.id("users"),
    createdAt: v.number(),
    // Optional link to a spec `plans` row (spec §26) so sales analytics can
    // join batches to configured plan prices.
    planId: v.optional(v.id("plans")),
  }).index("by_market", ["marketId"]),

  auditLog: defineTable({
    ...tenantScope,
    action: v.string(),
    entityTable: v.string(),
    entityId: v.string(),
    changedBy: v.id("users"),
    beforeJson: v.optional(v.string()),
    afterJson: v.optional(v.string()),
    timestamp: v.number(),
    ip: v.optional(v.string()),
    // Existing audit rows remain intentionally unsealed. New rows are linked
    // by the centralized writer in lib/auditLog.ts.
    chainSequence: v.optional(v.number()),
    prevHash: v.optional(v.string()),
    hash: v.optional(v.string()),
  })
    .index("by_entity", ["entityTable"])
    .index("by_timestamp", ["timestamp"])
    .index("by_tenant_timestamp", ["tenantId", "timestamp"]),

  // ==========================================================================
  // EXPANSION PIPELINE (market prospects, separate from live markets)
  // ==========================================================================

  marketProspects: defineTable({
    name: v.string(),
    country: v.string(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
    pipelineStatus: v.union(
      v.literal("prospect"),
      v.literal("negotiating"),
      v.literal("provisioning"),
      v.literal("live")
    ),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
    convertedMarketId: v.optional(v.id("markets")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deleteReason: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    restoredBy: v.optional(v.id("users")),
  })
    .index("by_status", ["pipelineStatus"])
    .index("by_country", ["country"]),

  // ==========================================================================
  // SUPPORT TICKETS
  // ==========================================================================

  supportTickets: defineTable({
    ...tenantScope,
    subject: v.string(),
    description: v.string(),
    ticketStatus: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("waiting_on_customer"),
      v.literal("resolved"),
      v.literal("closed")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    marketId: v.optional(v.id("markets")),
    agentId: v.optional(v.id("agents")),
    assignedTo: v.optional(v.id("users")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deleteReason: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    restoredBy: v.optional(v.id("users")),
  })
    .index("by_status", ["ticketStatus"])
    .index("by_market", ["marketId"])
    .index("by_agent", ["agentId"])
    .index("by_assigned", ["assignedTo"])
    .index("by_created", ["createdBy"]),

  // ==========================================================================
  // RENEWAL ATTRIBUTION (4.7 — conditional on provider CSV verification)
  // ==========================================================================

  // ==========================================================================
  // GAMIFICATION / LEADERBOARD
  // ==========================================================================

  leaderboardSnapshots: defineTable({
    ...tenantScope,
    snapshotDate: v.string(),
    agentId: v.id("agents"),
    marketId: v.optional(v.id("markets")),
    totalSalesVolume: v.number(),
    totalSalesCount: v.number(),
    renewalCount: v.number(),
    renewalRateAvailable: v.boolean(),
    renewalRate: v.optional(v.number()),
    totalCommissionEarned: v.number(),
    currency: v.string(),
    rank: v.number(),
    createdAt: v.number(),
  })
    .index("by_date", ["snapshotDate"])
    .index("by_agent_date", ["agentId", "snapshotDate"])
    .index("by_market_date", ["marketId", "snapshotDate"]),

  // ==========================================================================
  // BROADCASTS / COMMUNICATIONS
  // ==========================================================================

  broadcasts: defineTable({
    ...tenantScope,
    message: v.string(),
    channel: v.union(v.literal("sms")),
    targetScope: v.union(
      v.literal("all_agents"),
      v.literal("market_agents"),
      v.literal("specific_agents")
    ),
    targetMarketId: v.optional(v.id("markets")),
    targetAgentIds: v.optional(v.array(v.id("agents"))),
    sentBy: v.id("users"),
    sentAt: v.number(),
    recipientCount: v.number(),
    deliveryStatus: v.string(),
  })
    .index("by_sent", ["sentAt"])
    .index("by_market", ["targetMarketId"]),

  broadcastDeliveryLogs: defineTable({
    ...tenantScope,
    broadcastId: v.id("broadcasts"),
    agentId: v.id("agents"),
    phone: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    sentAt: v.number(),
  })
    .index("by_broadcast", ["broadcastId"])
    .index("by_agent", ["agentId"]),

  // ==========================================================================
  // AGENT INVITATIONS
  // ==========================================================================

  agentInvitations: defineTable({
    ...tenantScope,
    email: v.string(),
    phone: v.string(),
    name: v.string(),
    targetMarketId: v.optional(v.id("markets")),
    invitedBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    invitationToken: v.string(),
  })
    .index("by_token", ["invitationToken"])
    .index("by_email", ["email"]),

  // ==========================================================================
  // NOC SPEC V2 — EXCHANGE / FINANCIALS
  // ==========================================================================

  // Cached USD reference rates (spec §28), refreshed by the forex cron. The
  // daily/monthly financial rollups read this instead of calling APIs.
  exchangeRates: defineTable({
    date: v.string(),
    currency: v.string(),
    rateToUSD: v.number(),
    source: v.union(v.literal("primary"), v.literal("fallback")),
    refreshedAt: v.number(),
  })
    .index("by_currency_date", ["currency", "date"])
    .index("by_date", ["date"]),

  // Per-market, per-month financials (spec §22): paid-in vs. break-even.
  marketFinancials: defineTable({
    ...tenantScope,
    marketId: v.id("markets"),
    month: v.string(), // "2026-08"
    revenueLocal: v.number(),
    revenueUSD: v.number(),
    airtelCostLocal: v.number(),
    electricityCostLocal: v.number(),
    platformFeeLocal: v.number(),
    variableCostLocal: v.number(),
    netContributionLocal: v.number(),
    breakEvenStatus: v.union(v.literal("profit"), v.literal("break_even"), v.literal("loss")),
    currency: v.string(),
    enteredBy: v.id("users"),
    enteredAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_market_month", ["marketId", "month"])
    .index("by_month", ["month"]),

  // Subscriber snapshot projections (spec §24 population model).
  subscriberSnapshots: defineTable({
    ...tenantScope,
    marketId: v.id("markets"),
    date: v.string(), // "2026-08-14"
    activeCount: v.number(),
    newCount: v.number(),
    renewalCount: v.number(),
    renewalRate: v.optional(v.number()),
    avgPlanPriceLocal: v.optional(v.number()),
    currency: v.string(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_market_date", ["marketId", "date"])
    .index("by_date", ["date"]),

  // Thin ledger of every revenue-generating agent action (voucher sale,
  // renewal, new subscription). Single source for daily_snapshots, cost
  // allocation, analytics and the leaderboard (spec §25).
  agentActivity: defineTable({
    ...tenantScope,
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    action: v.union(v.literal("voucher_sale"), v.literal("renewal"), v.literal("new_subscription")),
    occurredAt: v.number(),
    amountLocal: v.number(),
    currency: v.string(),
    planCode: v.optional(v.string()),
    voucherId: v.optional(v.id("vouchers")),
    commissionAccruedLocal: v.optional(v.number()),
    platformFeeLocal: v.optional(v.number()),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_market", ["agentId", "marketId"])
    .index("by_market_time", ["marketId", "occurredAt"])
    .index("by_time", ["occurredAt"]),

  // Operating expenses ledger (spec §27). Modernises the legacy
  // marketOperatingCosts rows — a startup migration folds those in.
  expenses: defineTable({
    ...tenantScope,
    marketId: v.optional(v.id("markets")),
    category: v.union(
      v.literal("airtel_data"),
      v.literal("electricity"),
      v.literal("rent"),
      v.literal("salaries"),
      v.literal("fuel"),
      v.literal("maintenance"),
      v.literal("equipment"),
      v.literal("other")
    ),
    amountLocal: v.number(),
    currency: v.string(),
    amountUSD: v.number(),
    type: v.union(v.literal("fixed"), v.literal("variable")),
    month: v.string(), // "2026-08"
    enteredBy: v.id("users"),
    enteredAt: v.number(),
    receiptFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_market_month", ["marketId", "month"])
    .index("by_month", ["month"])
    .index("by_type", ["type"]),

  // Withdrawal / payout requests to any payee class (agent commissions,
  // investor dividends, vendors). Built on the spec §27 finance rules.
  payouts: defineTable({
    ...tenantScope,
    type: v.string(),
    payeeType: v.union(v.literal("user"), v.literal("agent"), v.literal("investor"), v.literal("vendor")),
    payeeId: v.string(),
    marketId: v.optional(v.id("markets")),
    amountLocal: v.number(),
    currency: v.string(),
    amountUSD: v.number(),
    method: v.union(v.literal("mpesa"), v.literal("airtel_money"), v.literal("bank_transfer"), v.literal("stripe")),
    status: v.union(v.literal("pending_approval"), v.literal("approved"), v.literal("processing"), v.literal("paid"), v.literal("rejected")),
    approvalTier: v.union(v.literal("tier_1"), v.literal("tier_2"), v.literal("tier_3")),
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    otpHash: v.optional(v.string()),
    otpVerifiedAt: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["status"])
    .index("by_payee_type_status", ["type", "status"])
    .index("by_payee", ["payeeId", "status"])
    .index("by_requested", ["requestedAt"]),

  // ==========================================================================
  // NOC SPEC V2 — INVESTORS / REPORTING
  // ==========================================================================

  investors: defineTable({
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.string(),
    investmentAmountUSD: v.number(),
    investmentDate: v.string(),
    equityPercent: v.optional(v.number()),
    instrumentType: v.union(v.literal("equity"), v.literal("safe"), v.literal("loan"), v.literal("revenue_share")),
    status: v.union(v.literal("active"), v.literal("exited"), v.literal("removed")),
    reportFrequency: v.union(v.literal("weekly"), v.literal("monthly")),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  // Frozen investor report snapshots — immutable once generated.
  investorReports: defineTable({
    investorId: v.optional(v.id("investors")),
    period: v.string(),
    snapshot: v.any(),
    generatedAt: v.number(),
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
  })
    .index("by_investor", ["investorId"])
    .index("by_period", ["period"]),

  // Per-market daily revenue/contribution snapshot (spec §25). The daily
  // rollup cron derives these from agentActivity + expenses.
  dailySnapshots: defineTable({
    ...tenantScope,
    marketId: v.id("markets"),
    date: v.string(), // "2026-08-14"
    revenueLocal: v.number(),
    revenueUSD: v.number(),
    salesCount: v.number(),
    newSubscribers: v.number(),
    variableCostLocal: v.number(),
    netContributionLocal: v.number(),
    avgUptimePercent: v.optional(v.number()),
    activeAlertsCount: v.optional(v.number()),
    topAgentId: v.optional(v.id("agents")),
    currency: v.string(),
    createdAt: v.number(),
  })
    .index("by_market_date", ["marketId", "date"])
    .index("by_date", ["date"]),

  // ==========================================================================
  // NOC SPEC V2 — PLANS / MAINTENANCE / NOTIFICATIONS
  // ==========================================================================

  // Configured tariff plans (spec §26). Existing voucher batches keep planType
  // and optionally reference a planId.
  plans: defineTable({
    ...tenantScope,
    marketId: v.optional(v.id("markets")),
    code: v.string(),
    name: v.string(),
    category: v.union(v.literal("data"), v.literal("tv"), v.literal("home_bundle")),
    priceLocal: v.number(),
    currency: v.string(),
    durationLabel: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_market", ["marketId"])
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  // Per-user alert preference matrix (spec §17 + §32).
  notificationPreferences: defineTable({
    ...tenantScope,
    userId: v.id("users"),
    category: v.union(
      v.literal("device_online"),
      v.literal("device_offline"),
      v.literal("low_ccq"),
      v.literal("high_tx_power"),
      v.literal("rogue_device"),
      v.literal("link_flap"),
      v.literal("high_cpu"),
      v.literal("high_memory"),
      v.literal("packet_loss"),
      v.literal("bounce_rate"),
      v.literal("renewal_digest"),
      v.literal("payout_status"),
      v.literal("daily_digest"),
      v.literal("investor_report")
    ),
    channel: v.union(v.literal("sms"), v.literal("email"), v.literal("dashboard")),
    enabled: v.boolean(),
    escalationDelayMinutes: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_category_channel", ["category", "channel"]),

  // Scheduled report definitions (spec §29); each run appends a reportExport.
  scheduledReports: defineTable({
    ...tenantScope,
    name: v.string(),
    reportType: v.union(v.literal("daily_digest"), v.literal("investor"), v.literal("custom_analytics")),
    recipients: v.array(v.string()),
    frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    scopeFilter: v.optional(v.any()),
    format: v.union(v.literal("pdf"), v.literal("csv")),
    enabled: v.boolean(),
    createdBy: v.id("users"),
    lastRunAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_enabled", ["enabled", "frequency"])
    .index("by_type", ["reportType"]),

  // One row per generated report artifact; file bytes live in _storage.
  reportExports: defineTable({
    ...tenantScope,
    scheduledReportId: v.optional(v.id("scheduledReports")),
    requestedBy: v.id("users"),
    format: v.union(v.literal("pdf"), v.literal("csv")),
    scopeFilter: v.optional(v.any()),
    dataset: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
    generatedAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_requested", ["requestedBy", "createdAt"])
    .index("by_status", ["status"])
    .index("by_report", ["scheduledReportId"]),

  // ==========================================================================
  // NOC SPEC V2 — CAPACITY / TELEMETRY ROLLUPS
  // ==========================================================================

  // Hourly per-device telemetry rollups (spec §20). The rollup cron folds
  // raw healthSamples/accessPointSamples into these for fast charting.
  // ==========================================================================
  // NOC SPEC V2 — TEAMS
  // ==========================================================================

  teams: defineTable({
    ...tenantScope,
    name: v.string(),
    leaderAgentId: v.optional(v.id("agents")),
    status: v.union(v.literal("active"), v.literal("removed")),
    createdAt: v.number(),
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["status"])
    .index("by_leader", ["leaderAgentId"]),

  teamMembers: defineTable({
    ...tenantScope,
    teamId: v.id("teams"),
    agentId: v.id("agents"),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_team", ["teamId"])
    .index("by_agent", ["agentId"])
    .index("by_team_member", ["teamId", "agentId"]),

  // ==========================================================================
  // PHASE 1 — TENANCY & ISOLATION (§B1, §B5)
  // ==========================================================================

  // A tenant is one ISP operator (or related operator group) that owns its own
  // sites, subscribers, routers, finance, and portal on the shared backend.
  // `tenantId` on every tenant-owned document is the isolation contract.
  tenants: defineTable({
    // Unique, immutable operator slug (reserved-slug policy per the
    // DNS/hostname secret plan). Never reused after a tenant is cancelled.
    slug: v.string(),
    name: v.string(),
    country: v.string(),
    timezone: v.string(),
    // ISO-4217 code (spec §22 allows any code as markets expand).
    currency: v.string(),
    status: v.union(
      // A newly created tenant may be staged while its administrator access
      // is being prepared. Automated onboarding completes as trial-ready.
      v.literal("provisioning"),
      v.literal("trial"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("cancelled"),
    ),
    // WorkOS per-tenant org id (three-scope model, Phase 2). The server-side
    // tenant resolver derives tenancy from this — never from the client.
    workosOrganizationId: v.optional(v.string()),
    // Contact phone captured during self-service sign-up (optional, never a
    // verification factor) and the acquisition channel that referred the
    // operator, if any. Both are seeded by the signup wizard.
    phone: v.optional(v.string()),
    acquisitionSource: v.optional(v.string()),
    settings: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_workosOrganizationId", ["workosOrganizationId"]),

  // Warehouse of which workforce user belongs to which tenant (org-scoped).
  tenantMemberships: defineTable({
    userId: v.id("users"),
    tenantId: v.id("tenants"),
    // Bounded to the Phase 2 permission catalogue; free string while migrating.
    role: v.string(),
    status: v.union(v.literal("active"), v.literal("pending"), v.literal("revoked")),
    // WorkOS membership id once the per-tenant org exists (Phase 2).
    workosMembershipId: v.optional(v.string()),
    invitedAt: v.optional(v.number()),
    joinedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_tenant", ["tenantId"])
    .index("by_user_tenant", ["userId", "tenantId"]),

  // Durable, retry-safe record for the background identity onboarding flow.
  // It holds no credentials or provider secret: only the minimum identity
  // references needed to resume safely after an action retry.
  tenantOnboardingRuns: defineTable({
    slug: v.string(),
    name: v.string(),
    country: v.string(),
    timezone: v.string(),
    currency: v.string(),
    ownerEmail: v.string(),
    ownerName: v.optional(v.string()),
    state: v.union(v.literal("pending"), v.literal("invited"), v.literal("failed"), v.literal("completed")),
    tenantId: v.optional(v.id("tenants")),
    workosOrganizationId: v.optional(v.string()),
    workosUserId: v.optional(v.string()),
    workosMembershipId: v.optional(v.string()),
    workosInvitationId: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_tenant", ["tenantId"])
    .index("by_state", ["state"]),

  // One self-service sign-up wizard run, keyed by the hash of the httpOnly
  // `__mylesnet_signup` cookie token. Holds irreversible step state so
  // back/forward, new-tab resumes (spec §12) and abandoned-run tracking all
  // work server-side. Never stores the raw token, the OTP code, or the
  // password; WorkOS owns the actual identity/credentials.
  signupSessions: defineTable({
    tokenHash: v.string(),
    state: v.union(
      v.literal("identity"),
      v.literal("code"),
      v.literal("organization"),
      v.literal("defaults"),
      v.literal("secure"),
      v.literal("provisioning"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("expired"),
    ),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    workosUserId: v.optional(v.string()),
    workosEmailVerified: v.optional(v.boolean()),
    emailVerifiedAt: v.optional(v.number()),
    codeSentAt: v.optional(v.number()),
    codeSentCount: v.optional(v.number()),
    codeAttempts: v.optional(v.number()),
    companyName: v.optional(v.string()),
    slug: v.optional(v.string()),
    country: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    referralSource: v.optional(v.string()),
    phone: v.optional(v.string()),
    consentAt: v.optional(v.number()),
    passwordSetAt: v.optional(v.number()),
    workosOrganizationId: v.optional(v.string()),
    workosMembershipId: v.optional(v.string()),
    tenantId: v.optional(v.id("tenants")),
    welcomeDeliveryId: v.optional(v.id("tenantWelcomeDeliveries")),
    provisioning: v.array(provisioningAttemptValidator),
    error: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_email", ["email"])
    .index("by_slug", ["slug"])
    .index("by_state", ["state"])
    .index("by_expires_at", ["expiresAt"]),

  // Auditable record that a self-service operator completed account
  // confirmation for the workspace. The legacy table name remains for
  // migration compatibility; it is not evidence that a separate welcome
  // email was sent. The identity provider owns verification delivery.
  tenantWelcomeDeliveries: defineTable({
    tenantId: v.id("tenants"),
    tenantSlug: v.string(),
    email: v.string(),
    kind: v.literal("signup_confirmation"),
    method: v.literal("workos"),
    deliveredAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_email", ["email"]),

  // SaaS plan / entitlement attached to a tenant (G-TEN, Phase 3). `planId` is
  // a plan code string until the T-PLN catalogue lands.
  entitlements: defineTable({
    tenantId: v.id("tenants"),
    planId: v.string(),
    status: v.union(
      v.literal("trial"),
      v.literal("active"),
      v.literal("expired"),
      v.literal("suspended"),
    ),
    startsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"]),

  // ==========================================================================
  // PHASE 0 — MIGRATION RUN INFRASTRUCTURE (§B2)
  // ==========================================================================

  // Tracks each migration as one idempotent, auditable, revertible run. A run
  // records bounded-batch progress (cursor/rowsProcessed), a rollback
  // checkpoint, the consolidated export manifest, assertion failures, and the
  // feature-flag gates that must be on before any enforcement checkpoint.
  migrationRuns: defineTable({
    // Immutable run id (e.g. "tenantid-backfill-001") shared across retries so
    // the run is idempotent even if the internal action re-runs.
    runId: v.string(),
    name: v.string(),
    tables: v.array(v.string()),
    status: v.union(
      v.literal("planned"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("rolled_back"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    // Bounded-backfill progress: the opaque cursor and rows processed so far.
    cursor: v.optional(v.string()),
    rowsProcessed: v.number(),
    // Declared rollback checkpoint for the most recent phase.
    rollbackCursor: v.optional(v.string()),
    rollbackRows: v.optional(v.number()),
    // Consolidated manifest of what the run moved / wrote, per table.
    // v.record() unavailable in Convex 1.44 — shape enforced by the runner.
    manifest: v.any(),
    // Feature-flag names that must be "on" before enforcement checkpoints.
    requiredFlags: v.array(v.string()),
    // Names of assertions that failed on the latest checkpoint (empty = green).
    failedAssertions: v.array(v.string()),
    error: v.optional(v.string()),
    startedBy: v.optional(v.id("users")),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_run_id", ["runId"])
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"]),
});
