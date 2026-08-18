import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table managed by Convex Auth
  users: defineTable({
    name: v.optional(v.string()),
    email: v.string(),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  // Router management
  routers: defineTable({
    name: v.string(),
    restBaseUrl: v.string(),
    location: v.string(), // e.g., "Tayari", "Mundindi"
    createdAt: v.number(),
    updatedAt: v.number(),
    cpuWarningThreshold: v.optional(v.number()), // CPU % for warning threshold
    cpuCriticalThreshold: v.optional(v.number()), // CPU % for critical threshold
  }).index("by_location", ["location"]),

  // Router credentials - NEVER exposed to client, only read in Convex actions
  routerCredentials: defineTable({
    routerId: v.id("routers"),
    encryptedUsername: v.string(),
    encryptedPassword: v.string(),
    updatedAt: v.number(),
  }).index("by_router", ["routerId"]),

  // Access point registry
  accessPoints: defineTable({
    routerId: v.id("routers"),
    name: v.string(),
    port: v.string(), // e.g., "ether2", "ether3", "ether4", "wlan1"
    deviceType: v.union(v.literal("cpe220"), v.literal("indoor_ap"), v.literal("builtin_radio"), v.literal("other")),
    sharesPortWith: v.optional(v.string()), // AP name if shares port with another AP
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_router", ["routerId"]),

  // Health samples - written every 30 seconds by scheduled action
  healthSamples: defineTable({
    routerId: v.id("routers"),
    accessPointId: v.optional(v.id("accessPoints")), // null for router-wide samples
    timestamp: v.number(),
    cpuPercent: v.number(),
    memoryPercent: v.number(),
    linkState: v.boolean(),
    txBytesPerSec: v.number(),
    rxBytesPerSec: v.number(),
    errorCount: v.number(),
    queueDrops: v.number(),
  }).index("by_router_timestamp", ["routerId", "timestamp"]),
  
  // Usage samples - written every 60 seconds, pruned after 180 days
  usageSamples: defineTable({
    routerId: v.id("routers"),
    accessPointId: v.optional(v.id("accessPoints")),
    subscriberIdentifier: v.string(), // hotspot username
    timestamp: v.number(),
    byteDelta: v.number(),
  })
  .index("by_router_timestamp", ["routerId", "timestamp"]),

  // Incidents
  incidents: defineTable({
    routerId: v.id("routers"),
    accessPointId: v.optional(v.id("accessPoints")),
    openedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.id("users")),
    note: v.string(),
    severity: v.string(), // "warning" | "critical"
  })
  .index("by_router_open", ["routerId", "openedAt"])
  .index("by_resolved", ["resolvedAt"]),

  // Shift notes - operational notes only, never customer PII or payment details
  shiftNotes: defineTable({
    routerId: v.id("routers"),
    authorId: v.id("users"),
    timestamp: v.number(),
    note: v.string(),
  }).index("by_router_timestamp", ["routerId", "timestamp"]),

  // Configuration watch baselines
  configWatchBaselines: defineTable({
    routerId: v.id("routers"),
    snapshotJson: v.string(),
    capturedAt: v.number(),
  }).index("by_router", ["routerId"]),
});
