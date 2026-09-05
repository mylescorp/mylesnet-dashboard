import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

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
    platformRole: v.optional(
      v.union(
        v.literal("platform_owner"),
        v.literal("platform_admin"),
        v.literal("platform_support"),
        v.literal("agent")
      )
    ),
  })
    .index("email", ["email"])
    .index("by_workosUserId", ["workosUserId"])
    .index("phone", ["phone"])
    .index("by_platformRole", ["platformRole"]),

  userMarketMemberships: defineTable({
    userId: v.id("users"),
    marketId: v.id("markets"),
    role: v.union(v.literal("manager"), v.literal("operator"), v.literal("viewer")),
    createdAt: v.number(),
    updatedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_market", ["userId", "marketId"])
    .index("by_market", ["marketId"]),

  // ==========================================================================
  // NETWORK MONITORING
  // ==========================================================================

  routers: defineTable({
    name: v.string(),
    restBaseUrl: v.string(),
    location: v.string(),
    marketId: v.optional(v.id("markets")),
    createdAt: v.number(),
    updatedAt: v.number(),
    cpuWarningThreshold: v.optional(v.number()),
    cpuCriticalThreshold: v.optional(v.number()),
    memoryWarningThreshold: v.optional(v.number()),
    memoryCriticalThreshold: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    archiveReason: v.optional(v.string()),
  })
    .index("by_location", ["location"])
    .index("by_market", ["marketId"]),

  routerCredentials: defineTable({
    routerId: v.id("routers"),
    encryptedUsername: v.string(),
    encryptedPassword: v.string(),
    updatedAt: v.number(),
  }).index("by_router", ["routerId"]),

  accessPoints: defineTable({
    routerId: v.id("routers"),
    name: v.string(),
    port: v.string(),
    deviceType: v.union(v.literal("cpe220"), v.literal("indoor_ap"), v.literal("builtin_radio"), v.literal("other")),
    sharesPortWith: v.optional(v.string()),
    capacity: v.optional(v.number()),
    rateLimitReference: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    archiveReason: v.optional(v.string()),
  }).index("by_router", ["routerId"]),

  /** Last authenticated collector result for each router. Never stores credentials. */
  collectorRuns: defineTable({
    routerId: v.id("routers"),
    observedAt: v.number(),
    status: v.union(v.literal("connected"), v.literal("failed")),
    message: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    consecutiveFailures: v.optional(v.number()),
    processUptimeMs: v.optional(v.number()),
  }).index("by_router_observedAt", ["routerId", "observedAt"]),

  healthSamples: defineTable({
    routerId: v.id("routers"),
    accessPointId: v.optional(v.id("accessPoints")),
    timestamp: v.number(),
    cpuPercent: v.number(),
    memoryPercent: v.number(),
    linkState: v.boolean(),
    txBytesPerSec: v.number(),
    rxBytesPerSec: v.number(),
    txBytes: v.optional(v.number()),
    rxBytes: v.optional(v.number()),
    connectedUserCount: v.optional(v.number()),
    errorCount: v.number(),
    queueDrops: v.number(),
  }).index("by_router_timestamp", ["routerId", "timestamp"]),

  accessPointSamples: defineTable({
    routerId: v.id("routers"),
    accessPointId: v.id("accessPoints"),
    timestamp: v.number(),
    linkState: v.boolean(),
    txBytesPerSec: v.number(),
    rxBytesPerSec: v.number(),
    errorCount: v.number(),
    queueDrops: v.number(),
    txBytes: v.number(),
    rxBytes: v.number(),
    connectedUserCount: v.optional(v.number()),
  }).index("by_access_point_timestamp", ["accessPointId", "timestamp"]),

  activeHotspotSessions: defineTable({
    routerId: v.id("routers"),
    accessPointId: v.optional(v.id("accessPoints")),
    sessionIdentifier: v.string(),
    subscriberIdentifier: v.string(),
    observedBytes: v.number(),
    observedAt: v.number(),
  })
    .index("by_router", ["routerId"])
    .index("by_router_session", ["routerId", "sessionIdentifier"])
    .index("by_access_point", ["accessPointId"]),

  usageSamples: defineTable({
    routerId: v.id("routers"),
    accessPointId: v.optional(v.id("accessPoints")),
    subscriberIdentifier: v.string(),
    timestamp: v.number(),
    byteDelta: v.number(),
    observedBytes: v.number(),
  })
    .index("by_router_timestamp", ["routerId", "timestamp"])
    .index("by_router_subscriber_timestamp", ["routerId", "subscriberIdentifier", "timestamp"])
    .index("by_access_point_timestamp", ["accessPointId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  incidents: defineTable({
    routerId: v.id("routers"),
    accessPointId: v.optional(v.id("accessPoints")),
    openedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.id("users")),
    note: v.string(),
    severity: v.string(),
  })
    .index("by_router_open", ["routerId", "openedAt"])
    .index("by_resolved", ["resolvedAt"])
    .index("by_router_severity_resolved", ["routerId", "severity", "resolvedAt"]),

  shiftNotes: defineTable({
    routerId: v.id("routers"),
    authorId: v.id("users"),
    timestamp: v.number(),
    note: v.string(),
  }).index("by_router_timestamp", ["routerId", "timestamp"]),

  configWatchBaselines: defineTable({
    routerId: v.id("routers"),
    snapshotJson: v.string(),
    capturedAt: v.number(),
  }).index("by_router", ["routerId"]),

  routerConfigurationSnapshots: defineTable({
    routerId: v.id("routers"),
    observedAt: v.number(),
    snapshotJson: v.string(),
  }).index("by_router_timestamp", ["routerId", "observedAt"]),

  /** Live DHCP leases observed by the collector — subscriber IP↔MAC↔host mapping. */
  dhcpLeases: defineTable({
    routerId: v.id("routers"),
    ipAddress: v.string(),
    macAddress: v.string(),
    hostname: v.optional(v.string()),
    status: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    observedAt: v.number(),
  })
    .index("by_router", ["routerId"])
    .index("by_router_ip", ["routerId", "ipAddress"])
    .index("by_mac", ["macAddress"]),

  /** RouterOS simple queues observed by the collector — per-subscriber rate limits. */
  simpleQueues: defineTable({
    routerId: v.id("routers"),
    name: v.string(),
    target: v.optional(v.string()),
    rateBps: v.optional(v.number()),
    maxLimitBps: v.optional(v.number()),
    disabled: v.optional(v.boolean()),
    observedAt: v.number(),
  })
    .index("by_router", ["routerId"])
    .index("by_router_name", ["routerId", "name"]),

  /** Latest per-router telemetry details (identity, system health, ports, wifi radios). */
  routerTelemetry: defineTable({
    routerId: v.id("routers"),
    observedAt: v.number(),
    identity: v.optional(v.string()),
    systemHealth: v.optional(
      v.object({
        temperature: v.optional(v.number()),
        temperatureUnit: v.optional(v.string()),
        voltage: v.optional(v.number()),
        badDrivers: v.optional(v.array(v.string())),
      })
    ),
    ethernetPorts: v.optional(
      v.array(
        v.object({
          name: v.string(),
          running: v.optional(v.boolean()),
          linkSpeedMbps: v.optional(v.number()),
          duplex: v.optional(v.string()),
          disabled: v.optional(v.boolean()),
        })
      )
    ),
    wifiRadios: v.optional(
      v.array(
        v.object({
          interfaceName: v.string(),
          state: v.optional(v.string()),
          frequency: v.optional(v.number()),
          channel: v.optional(v.string()),
          signalStrength: v.optional(v.number()),
          clientCount: v.optional(v.number()),
        })
      )
    ),
  }).index("by_router", ["routerId"]),

  /** Operator-facing telemetry self-health events (ingest latency, backoff, drops). */
  systemEvents: defineTable({
    routerId: v.optional(v.id("routers")),
    accessPointId: v.optional(v.id("accessPoints")),
    type: v.union(
      v.literal("ingest_latency"),
      v.literal("rate_limited"),
      v.literal("dropped"),
      v.literal("collector_backoff"),
      v.literal("partial_telemetry"),
    ),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    title: v.string(),
    details: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_occurredAt", ["occurredAt"])
    .index("by_router", ["routerId"])
    .index("by_type", ["type"]),

  // ==========================================================================
  // CENTIPID INTEGRATION
  // ==========================================================================

  centipidCredentials: defineTable({
    apiToken: v.string(),
    webhookSigningSecret: v.string(),
    ingestionPaused: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  subscriberEvents: defineTable({
    centipidSubscriberId: v.string(),
    eventType: v.string(),
    phone: v.string(),
    name: v.optional(v.string()),
    packageName: v.string(),
    timestamp: v.number(),
    rawPayloadRef: v.optional(v.string()),
    webhookEventId: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"])
    .index("by_subscriber", ["centipidSubscriberId"])
    .index("by_webhookEventId", ["webhookEventId"]),

  paymentEvents: defineTable({
    centipidPaymentId: v.string(),
    eventType: v.string(),
    amount: v.number(),
    currency: v.string(),
    method: v.string(),
    subscriberPhone: v.string(),
    timestamp: v.number(),
    webhookEventId: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"])
    .index("by_payment", ["centipidPaymentId"])
    .index("by_webhookEventId", ["webhookEventId"]),

  voucherEvents: defineTable({
    centipidVoucherId: v.string(),
    eventType: v.string(),
    packageName: v.string(),
    timestamp: v.number(),
    webhookEventId: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"])
    .index("by_voucher", ["centipidVoucherId"])
    .index("by_webhookEventId", ["webhookEventId"])
    .index("by_customerPhone", ["customerPhone"]),

  ticketEvents: defineTable({
    centipidTicketId: v.string(),
    eventType: v.string(),
    subject: v.string(),
    timestamp: v.number(),
    webhookEventId: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"])
    .index("by_ticket", ["centipidTicketId"])
    .index("by_webhookEventId", ["webhookEventId"]),

  webhookDeliveryLog: defineTable({
    receivedAt: v.number(),
    eventType: v.string(),
    signatureValid: v.boolean(),
    processed: v.boolean(),
    errorMessage: v.optional(v.string()),
    signatureHeader: v.optional(v.string()),
    rawBodyPreview: v.optional(v.string()),
  }).index("by_receivedAt", ["receivedAt"]),

  latestSubscriberState: defineTable({
    centipidSubscriberId: v.string(),
    status: v.union(v.literal("active"), v.literal("paused")),
    phone: v.string(),
    name: v.optional(v.string()),
    packageName: v.string(),
    lastEventType: v.string(),
    lastSeen: v.number(),
  }).index("by_subscriber", ["centipidSubscriberId"])
    .index("by_status", ["status"]),

  ticketStatus: defineTable({
    centipidTicketId: v.string(),
    status: v.union(v.literal("open"), v.literal("resolved")),
    subject: v.string(),
    openedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    lastSeen: v.number(),
  }).index("by_ticket", ["centipidTicketId"])
    .index("by_status", ["status"]),

  // ==========================================================================
  // MASTER ADMIN / PLATFORM (business operations)
  // ==========================================================================

  markets: defineTable({
    name: v.string(),
    country: v.string(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
    lifecycleStatus: v.union(v.literal("planned"), v.literal("active"), v.literal("paused"), v.literal("decommissioned")),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deleteReason: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    restoredBy: v.optional(v.id("users")),
  }).index("by_status", ["status"]),

  marketOperatingCosts: defineTable({
    marketId: v.id("markets"),
    yearMonth: v.string(),
    airtelDataCost: v.number(),
    electricityCost: v.number(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
    reportedBy: v.id("users"),
    reportedAt: v.number(),
  })
    .index("by_market_month", ["marketId", "yearMonth"])
    .index("by_market", ["marketId"]),

  devices: defineTable({
    marketId: v.id("markets"),
    parentDeviceId: v.optional(v.id("devices")),
    name: v.string(),
    deviceKind: v.string(),
    serialOrMac: v.optional(v.string()),
    lifecycleStatus: v.string(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deleteReason: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    restoredBy: v.optional(v.id("users")),
  })
    .index("by_market", ["marketId"])
    .index("by_parent", ["parentDeviceId"])
    .index("by_lifecycleStatus", ["lifecycleStatus"])
    .index("by_status", ["status"]),

  deviceReplacementEvents: defineTable({
    deviceId: v.id("devices"),
    replacedAt: v.number(),
    oldSerialOrMac: v.optional(v.string()),
    newSerialOrMac: v.optional(v.string()),
    reason: v.string(),
    loggedBy: v.id("users"),
  }).index("by_device", ["deviceId"]),

  agents: defineTable({
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
  })
    .index("by_lifecycleStatus", ["lifecycleStatus"])
    .index("by_status", ["status"]),

  agentMarketAssignments: defineTable({
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    assignmentStatus: v.string(),
    compensationType: v.string(),
    commissionRate: v.number(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    endReason: v.optional(v.string()),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_status", ["agentId", "assignmentStatus"])
    .index("by_market", ["marketId"]),

  commissions: defineTable({
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    voucherId: v.optional(v.id("vouchers")),
    amount: v.number(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
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
    .index("by_status", ["payoutStatus"])
    .index("by_agent", ["agentId"]),

  vouchers: defineTable({
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
  })
    .index("by_batch", ["batchId"])
    .index("by_code", ["code"])
    .index("by_status", ["voucherStatus"])
    .index("by_owner", ["ownerAgentId"])
    .index("by_market", ["marketId"]),

  voucherBatches: defineTable({
    marketId: v.id("markets"),
    planType: v.string(),
    quantity: v.number(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
    priceEach: v.number(),
    generatedBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_market", ["marketId"]),

  alerts: defineTable({
    marketId: v.id("markets"),
    rootDeviceId: v.id("devices"),
    dependentDeviceIds: v.array(v.id("devices")),
    alertType: v.string(),
    message: v.string(),
    alertStatus: v.string(),
    openedAt: v.number(),
    acknowledgedBy: v.optional(v.id("users")),
    acknowledgedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status", ["alertStatus"])
    .index("by_rootDevice", ["rootDeviceId"]),

  auditLog: defineTable({
    action: v.string(),
    entityTable: v.string(),
    entityId: v.string(),
    changedBy: v.id("users"),
    beforeJson: v.optional(v.string()),
    afterJson: v.optional(v.string()),
    timestamp: v.number(),
    ip: v.optional(v.string()),
  }).index("by_entity", ["entityTable"]),

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
  // RENEWAL ATTRIBUTION (4.7 — conditional on Centipid CSV verification)
  // ==========================================================================

  renewalCredits: defineTable({
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    customerPhone: v.string(),
    initialVoucherId: v.id("vouchers"),
    renewalType: v.string(),
    renewalAmount: v.number(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
    centipidMatchRef: v.optional(v.string()),
    creditedAt: v.number(),
    reconciliationBatchId: v.optional(v.string()),
  })
    .index("by_agent", ["agentId"])
    .index("by_market", ["marketId"])
    .index("by_phone", ["customerPhone"])
    .index("by_batch", ["reconciliationBatchId"]),

  // ==========================================================================
  // GAMIFICATION / LEADERBOARD
  // ==========================================================================

  leaderboardSnapshots: defineTable({
    snapshotDate: v.string(),
    agentId: v.id("agents"),
    marketId: v.optional(v.id("markets")),
    totalSalesVolume: v.number(),
    totalSalesCount: v.number(),
    renewalCount: v.number(),
    renewalRateAvailable: v.boolean(),
    renewalRate: v.optional(v.number()),
    totalCommissionEarned: v.number(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
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
});
