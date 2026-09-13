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
    // Estate bridge (spec "Device Information").
    macAddress: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
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
    networkAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    model: v.optional(v.string()),
    note: v.optional(v.string()),
    switchId: v.optional(v.id("networkSwitches")),
    switchPort: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    archiveReason: v.optional(v.string()),
    // Estate bridge (spec "Device Information"): when an access point is
    // registered in the spec device registry, these fields track liveness and
    // who registered it.
    lastSeenAt: v.optional(v.number()),
    registeredBy: v.optional(v.union(v.literal("self"), v.id("users"))),
    lastSnapshotCcq: v.optional(v.number()),
    lastSnapshotSignalDbm: v.optional(v.number()),
  }).index("by_router", ["routerId"]),

  /** Layer-2 switches that sit between a router port and downstream access points. */
  networkSwitches: defineTable({
    routerId: v.id("routers"),
    name: v.string(),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    routerPort: v.optional(v.string()),
    portCount: v.optional(v.number()),
    managed: v.optional(v.boolean()),
    note: v.optional(v.string()),
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
    // Wi-Fi quality (spec "Device Details"): required for CCQ threshold alerts
    // and signal-strength capacity planning.
    ccq: v.optional(v.number()),
    signalStrengthDbm: v.optional(v.number()),
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
      v.literal("notification"),
      v.literal("self_heal_action"),
      v.literal("self_heal_failed"),
      v.literal("chronic_self_heal"),
      v.literal("healthguard_stale"),
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
  // COLLECTOR SELF-HEAL & OPERATOR COMMAND QUEUE
  // ==========================================================================

  /**
   * Global operator settings served to collectors. Missing rows mean the
   * built-in default (e.g. collectors treat a missing healthguardEnabled row
   * as enabled). One row per key.
   */
  system_settings: defineTable({
    key: v.string(),
    valueJson: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  /**
   * Operator-queued actions executed by the local collector on its next
   * check-in. The collector acknowledges a command, the server records that
   * durable clear, and only then does the collector act — so a router write
   * never happens around an un-acked command.
   */
  device_commands: defineTable({
    routerId: v.id("routers"),
    type: v.union(
      v.literal("reenable_www_ssl"),
      v.literal("restart_collector"),
      v.literal("run_full_healthcheck"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("acknowledged"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("superseded"),
    ),
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    supersededAt: v.optional(v.number()),
    supersededByCommandId: v.optional(v.id("device_commands")),
    errorMessage: v.optional(v.string()),
    attempts: v.number(),
    expiresAt: v.number(),
  })
    .index("by_router_status", ["routerId", "status"])
    .index("by_router_type_status", ["routerId", "type", "status"])
    .index("by_status_expiresAt", ["status", "expiresAt"]),

  /**
   * Latest healthguard observation per router. One row per router; the
   * collector's telemetry upserts it on every push.
   */
  healthguardStates: defineTable({
    routerId: v.id("routers"),
    lastRunAt: v.optional(v.number()),
    wwwSslEnabled: v.optional(v.boolean()),
    lastAction: v.optional(
      v.union(
        v.literal("none"),
        v.literal("reenabled_www_ssl"),
        v.literal("reenable_failed"),
        v.literal("flagged_disabled"),
      )
    ),
    lastActionAt: v.optional(v.number()),
    lastActionMessage: v.optional(v.string()),
    reenableTimestamps24h: v.optional(v.array(v.number())),
    chronicAlertedAt: v.optional(v.number()),
    staleAlertedAt: v.optional(v.number()),
  }).index("by_router", ["routerId"]),

  // ==========================================================================
  // CENTIPID INTEGRATION
  // ==========================================================================

  centipidCredentials: defineTable({
    apiToken: v.string(),
    webhookSigningSecret: v.string(),
    ingestionPaused: v.optional(v.boolean()),
    lastHealthCheckAt: v.optional(v.number()),
    lastHealthCheckOk: v.optional(v.boolean()),
    lastHealthCheckError: v.optional(v.string()),
    // Persisted MCP output lets authorized Convex subscribers update without
    // keeping a browser-only action result or using a manual refresh button.
    liveSnapshotAt: v.optional(v.number()),
    liveSnapshotRevenueToday: v.optional(v.union(v.number(), v.null())),
    liveSnapshotRevenueYesterday: v.optional(v.union(v.number(), v.null())),
    liveSnapshotSubscribersOnline: v.optional(v.union(v.number(), v.null())),
    liveSnapshotActiveSubscriptions: v.optional(v.union(v.number(), v.null())),
    liveSnapshotExpiring24h: v.optional(v.union(v.number(), v.null())),
    liveSnapshotUnreconciledPayments: v.optional(v.union(v.number(), v.null())),
    liveSnapshotCurrency: v.optional(v.string()),
    liveSnapshotLastAttemptAt: v.optional(v.number()),
    liveSnapshotLastAttemptOk: v.optional(v.boolean()),
    liveSnapshotLastAttemptError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
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
    .index("by_status", ["status"])
    .index("by_country", ["country"]),

  marketOperatingCosts: defineTable({
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
    // Business/NOC bridge fields (spec "Device Information"): the devices table
    // doubles as the spec device registry, linked to the ops estate below.
    deviceType: v.optional(
      v.union(v.literal("mikrotik"), v.literal("outdoor_ap"), v.literal("indoor_ap"), v.literal("extender"))
    ),
    role: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
    registeredBy: v.optional(v.union(v.literal("self"), v.id("users"))),
    routerId: v.optional(v.id("routers")),
    accessPointId: v.optional(v.id("accessPoints")),
  })
    .index("by_market", ["marketId"])
    .index("by_parent", ["parentDeviceId"])
    .index("by_lifecycleStatus", ["lifecycleStatus"])
    .index("by_status", ["status"])
    .index("by_macAddress", ["macAddress"]),

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
    // NOC spec "Agent Management": optional platform account link + default
    // commission model + achievement badges.
    userId: v.optional(v.id("users")),
    commissionModel: v.optional(v.union(v.literal("percentage"), v.literal("flat_per_sale"), v.literal("bonus_based"))),
    badges: v.optional(v.array(v.string())),
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
    currency: v.string(),
    priceEach: v.number(),
    generatedBy: v.id("users"),
    createdAt: v.number(),
    // Optional link to a spec `plans` row (spec §26) so sales analytics can
    // join batches to configured plan prices.
    planId: v.optional(v.id("plans")),
  }).index("by_market", ["marketId"]),

  alerts: defineTable({
    marketId: v.id("markets"),
    rootDeviceId: v.optional(v.id("devices")),
    dependentDeviceIds: v.array(v.id("devices")),
    alertType: v.string(),
    message: v.string(),
    alertStatus: v.string(),
    openedAt: v.number(),
    acknowledgedBy: v.optional(v.id("users")),
    acknowledgedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    // NOC spec §17 alert enrichments. `triggeredAt` aliases `openedAt` under
    // the spec name; escalation uses severity + channels.
    triggeredAt: v.optional(v.number()),
    severity: v.optional(v.union(v.literal("info"), v.literal("warning"), v.literal("critical"))),
    notifiedVia: v.optional(v.array(v.union(v.literal("sms"), v.literal("email"), v.literal("dashboard")))),
    ownerId: v.optional(v.id("users")),
    recommendedAction: v.optional(v.string()),
  })
    .index("by_status", ["alertStatus"])
    .index("by_rootDevice", ["rootDeviceId"])
    .index("by_market_status", ["marketId", "alertStatus"]),

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
    currency: v.string(),
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
    marketId: v.id("markets"),
    month: v.string(), // "2026-08"
    revenueLocal: v.number(),
    revenueUSD: v.number(),
    airtelCostLocal: v.number(),
    electricityCostLocal: v.number(),
    centipidFeeLocal: v.number(),
    variableCostLocal: v.number(),
    netContributionLocal: v.number(),
    breakEvenStatus: v.union(v.literal("profit"), v.literal("break_even"), v.literal("loss")),
    currency: v.string(),
    enteredBy: v.id("users"),
    enteredAt: v.number(),
  })
    .index("by_market_month", ["marketId", "month"])
    .index("by_month", ["month"]),

  // Subscriber snapshot projections (spec §24 population model).
  subscriberSnapshots: defineTable({
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
    .index("by_market_date", ["marketId", "date"])
    .index("by_date", ["date"]),

  // Thin ledger of every revenue-generating agent action (voucher sale,
  // renewal, new subscription). Single source for daily_snapshots, cost
  // allocation, analytics and the leaderboard (spec §25).
  agentActivity: defineTable({
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
    .index("by_market_month", ["marketId", "month"])
    .index("by_month", ["month"])
    .index("by_type", ["type"]),

  // Withdrawal / payout requests to any payee class (agent commissions,
  // investor dividends, vendors). Built on the spec §27 finance rules.
  payouts: defineTable({
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

  // Scheduled maintenance windows suppress alerting for the covered devices
  // (spec §17 maintenance mode).
  maintenanceWindows: defineTable({
    marketId: v.id("markets"),
    deviceId: v.optional(v.id("devices")),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    reason: v.string(),
    suppressAlerts: v.boolean(),
    status: v.union(v.literal("scheduled"), v.literal("active"), v.literal("completed"), v.literal("cancelled")),
    createdBy: v.id("users"),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_market", ["marketId"])
    .index("by_status", ["status"])
    .index("by_device", ["deviceId"]),

  // Per-user alert preference matrix (spec §17 + §32).
  notificationPreferences: defineTable({
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

  // Approved device/build configurations (spec "Device Information").
  standardSiteKit: defineTable({
    deviceType: v.union(v.literal("mikrotik"), v.literal("outdoor_ap"), v.literal("indoor_ap"), v.literal("extender")),
    approvedModel: v.string(),
    approvedFirmwareVersion: v.optional(v.string()),
    requiresUps: v.boolean(),
    snmpProfile: v.optional(v.string()),
    effectiveFrom: v.string(),
    status: v.union(v.literal("active"), v.literal("superseded")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_device_type", ["deviceType", "status"])
    .index("by_status", ["status"]),

  // Scheduled report definitions (spec §29); each run appends a reportExport.
  scheduledReports: defineTable({
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
  telemetryHourly: defineTable({
    marketId: v.id("markets"),
    deviceKind: v.union(v.literal("router"), v.literal("access_point")),
    routerId: v.optional(v.id("routers")),
    accessPointId: v.optional(v.id("accessPoints")),
    deviceId: v.optional(v.id("devices")),
    hourStart: v.number(),
    sampleCount: v.number(),
    avgCpuPercent: v.optional(v.number()),
    avgMemoryPercent: v.optional(v.number()),
    avgTxRateMbps: v.number(),
    avgRxRateMbps: v.number(),
    maxTxRateMbps: v.number(),
    maxRxRateMbps: v.number(),
    maxConnectedClients: v.number(),
    avgCcq: v.optional(v.number()),
    avgSignalStrengthDbm: v.optional(v.number()),
  })
    .index("by_market_hour", ["marketId", "hourStart"])
    .index("by_router_hour", ["routerId", "hourStart"])
    .index("by_access_point_hour", ["accessPointId", "hourStart"])
    .index("by_device_hour", ["deviceId", "hourStart"]),

  telemetryDaily: defineTable({
    marketId: v.id("markets"),
    deviceKind: v.union(v.literal("router"), v.literal("access_point")),
    routerId: v.optional(v.id("routers")),
    accessPointId: v.optional(v.id("accessPoints")),
    deviceId: v.optional(v.id("devices")),
    date: v.string(),
    sampleCount: v.number(),
    avgCpuPercent: v.optional(v.number()),
    avgMemoryPercent: v.optional(v.number()),
    avgTxRateMbps: v.number(),
    avgRxRateMbps: v.number(),
    maxTxRateMbps: v.number(),
    maxRxRateMbps: v.number(),
    maxConnectedClients: v.number(),
    avgCcq: v.optional(v.number()),
    avgSignalStrengthDbm: v.optional(v.number()),
  })
    .index("by_market_date", ["marketId", "date"])
    .index("by_router_date", ["routerId", "date"])
    .index("by_access_point_date", ["accessPointId", "date"])
    .index("by_device_date", ["deviceId", "date"]),

  // ==========================================================================
  // NOC SPEC V2 — TEAMS
  // ==========================================================================

  teams: defineTable({
    name: v.string(),
    leaderAgentId: v.optional(v.id("agents")),
    status: v.union(v.literal("active"), v.literal("removed")),
    createdAt: v.number(),
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
  })
    .index("by_status", ["status"])
    .index("by_leader", ["leaderAgentId"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    agentId: v.id("agents"),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
  })
    .index("by_team", ["teamId"])
    .index("by_agent", ["agentId"])
    .index("by_team_member", ["teamId", "agentId"]),

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
