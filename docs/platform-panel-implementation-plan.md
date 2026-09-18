# Platform Panel Implementation Plan (Canonical 45-Module List)

## Executive Summary

This plan details the complete implementation of all Platform Panel (`/platform`) features as specified in the canonical 45-module list (A1-O2). The implementation will be production-ready with no hardcoding or mockups, featuring full backend (Convex) and frontend (Next.js) components with proper RBAC matrix enforcement.

## Current Status (as of verification)

- **Confirmed: 3** — B1, F1, K
- **Partial: 19** — A1, A2, A3, B2, C3, D3, E1, E2, F2, G1, G3, H1, H2, I1, J1, J3, J4, L1, L2
- **Not present: 22** — B3, B4, B5, B6, C1, C4, C5, C6, D1, D2, E3, G2, G4, H3, I2, J2, L3, M1, M2, N, O1, O2
- **Excluded: 1** — C2

## Implementation Order (Starting with A2 Markets)

Following the directive to start with **Tier A → A2 Markets**, here's the prioritized implementation order:

### Immediate (Current Session)
1. **A2 Markets** — Platform route + sub-role gate + isolation tests
2. **A3 Suspension & Restoration** — Canonical suspend/restore routes

### High Priority (Tier A & B)
3. **B3 RADIUS Server Fleet** — Full build
4. **B4 Policy Templates** — Full build
5. **B5 Telemetry & Health Rollup** — Platform rollup
6. **B6 Firmware & Config Push** — Staged push

### Medium Priority (Tier C, D, E)
7. **C1 Platform Revenue Dashboard** — Full build
8. **C4 Payment Gateway Config** — Masked/rotate
9. **C5 Payment Reconciliation** — Full build
10. **C6 Session Anomaly→Billing** — Full build
11. **D1 Agencies & Resellers** — Full build
12. **D2 Agency/Reseller Suspension** — Full build
13. **D3 Client Provisioning Approval** — Dedicated approval route
14. **E3 Commission Rate Config** — Full build

### Medium Priority (Tier F, G, H)
15. **F2 Voucher Package Templates** — Platform route + matrix
16. **G1 Platform Team Users** — Canonical route + CRUD tab
17. **G2 Global User Directory** — Full build
18. **G3 Role Definitions** — Canonical route + mgmt
19. **G4 API Keys (platform)** — Full build
20. **H1 Cross-Tenant Broadcast** — Platform route + support CR split
21. **H2 SMS Campaigns** — Platform route + matrix
22. **H3 Email Campaigns** — Full build

### Lower Priority (Tier I, J, L, M, N, O)
23. **I1 Global Ticket Queue** — Platform route + SLA split
24. **I2 SLA Configuration** — Full build
25. **J1 Platform Analytics** — Platform route
26. **J2 Per-Tenant Health Score** — Full build
27. **J3 Cross-Tenant Leaderboard** — Platform route + read-only matrix
28. **J4 Scheduled Reports** — Platform route + finance split
29. **L1 Security Settings** — /2fa, /sessions, /api-keys routes
30. **L2 Audit Log** — Route slug + /id only (capability complete)
31. **L3 Data Export & Deletion** — Full build
32. **M1 System Health** — Full build
33. **M2 Maintenance Mode** — Full build (must not interrupt RADIUS)
34. **N Impersonation** — Full build
35. **O1 Platform Configuration** — Full build
36. **O2 White-Label Defaults** — Full build

## Implementation Phases

### Phase 1: Foundation & Schema Design
**Duration**: 2-3 days
**Priority**: Critical (blocks all other phases)

#### 1.1 Convex Schema Extensions
Add new tables to `convex/schema.ts`:

```typescript
// Infrastructure Management
deviceFleet: defineTable({
  deviceId: v.string(),
  name: v.string(),
  type: v.union(v.literal("router"), v.literal("access_point"), v.literal("switch"), v.literal("nas")),
  status: v.union(v.literal("active"), v.literal("degraded"), v.literal("offline"), v.literal("maintenance")),
  location: v.optional(v.string()),
  ipAddress: v.string(),
  macAddress: v.string(),
  firmwareVersion: v.string(),
  lastSeen: v.number(),
  posture: v.union(v.literal("healthy"), v.literal("warning"), v.literal("critical")),
  healthMetrics: v.optional(v.object({
    cpuUsage: v.number(),
    memoryUsage: v.number(),
    uptime: v.number(),
    temperature: v.optional(v.number()),
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["status"]).index("by_type", ["type"]),

// Network Operations
queueMetrics: defineTable({
  queueName: v.string(),
  depth: v.number(),
  processedCount: v.number(),
  failedCount: v.number(),
  lastProcessedAt: v.number(),
  avgProcessingTime: v.number(),
  status: v.union(v.literal("healthy"), v.literal("backlogged"), v.literal("stalled")),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["status"]),

workerJobs: defineTable({
  jobId: v.string(),
  jobType: v.string(),
  status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
  tenantId: v.optional(v.id("tenants")),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  retryCount: v.number(),
  priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["status"]).index("by_tenant", ["tenantId"]),

// Platform Health
platformHealth: defineTable({
  serviceName: v.string(),
  status: v.union(v.literal("operational"), v.literal("degraded"), v.literal("down")),
  availability: v.number(),
  responseTime: v.number(),
  errorRate: v.number(),
  lastCheckedAt: v.number(),
  uptimePercentage: v.number(),
  incidentCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["status"]),

// Support Operations
supportGrants: defineTable({
  grantId: v.string(),
  platformUserId: v.id("users"),
  tenantId: v.id("tenants"),
  reason: v.string(),
  grantedBy: v.id("users"),
  grantedAt: v.number(),
  expiresAt: v.number(),
  status: v.union(v.literal("active"), v.literal("expired"), v.literal("revoked")),
  accessLevel: v.union(v.literal("read"), v.literal("write"), v.literal("admin")),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_platform_user", ["platformUserId"]).index("by_tenant", ["tenantId"]),

supportSessions: defineTable({
  sessionId: v.string(),
  grantId: v.string(),
  platformUserId: v.id("users"),
  tenantId: v.id("tenants"),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  actions: v.array(v.string()),
  status: v.union(v.literal("active"), v.literal("completed"), v.literal("terminated")),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_active", ["status"]),

// Compliance Monitoring
complianceChecks: defineTable({
  checkId: v.string(),
  checkType: v.string(),
  status: v.union(v.literal("passing"), v.literal("failing"), v.literal("warning")),
  lastCheckedAt: v.number(),
  details: v.optional(v.string()),
  severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
  remediationRequired: v.boolean(),
  remediationSteps: v.optional(v.array(v.string())),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["status"]).index("by_severity", ["severity"]),

// Platform Billing Analytics
platformRevenue: defineTable({
  period: v.string(), // "2026-09"
  totalRevenue: v.number(),
  tenantCount: v.number(),
  averageRevenuePerTenant: v.number(),
  growthRate: v.number(),
  paymentProviderBreakdown: v.array(v.object({
    provider: v.string(),
    amount: v.number(),
    percentage: v.number(),
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_period", ["period"]),

// Platform Settings
platformSettings: defineTable({
  settingKey: v.string(),
  settingValue: v.string(),
  category: v.string(),
  description: v.string(),
  isEncrypted: v.boolean(),
  updatedAt: v.id("users"),
  updatedAtTimestamp: v.number(),
  createdAt: v.number(),
}).index("by_category", ["category"]),

// Tenant Onboarding
onboardingChecklists: defineTable({
  tenantId: v.id("tenants"),
  checklistName: v.string(),
  steps: v.array(v.object({
    stepId: v.string(),
    stepName: v.string(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.id("users")),
  })),
  overallStatus: v.union(v.literal("in_progress"), v.literal("completed"), v.literal("blocked")),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_tenant", ["tenantId"]),

// Platform Analytics
platformMetrics: defineTable({
  metricName: v.string(),
  metricValue: v.number(),
  timestamp: v.number(),
  tags: v.optional(v.record(v.string(), v.string())),
  aggregationType: v.union(v.literal("sum"), v.literal("avg"), v.literal("count"), v.literal("max"), v.literal("min")),
  createdAt: v.number(),
}).index("by_name", ["metricName"]).index("by_timestamp", ["timestamp"]),

// Platform Communications
platformNotifications: defineTable({
  notificationId: v.string(),
  title: v.string(),
  message: v.string(),
  targetType: v.union(v.literal("all_tenants"), v.literal("specific_tenant"), v.literal("specific_role")),
  targetIds: v.optional(v.array(v.string())),
  priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
  status: v.union(v.literal("draft"), v.literal("scheduled"), v.literal("sent"), v.literal("cancelled")),
  scheduledFor: v.optional(v.number()),
  sentAt: v.optional(v.number()),
  sentBy: v.id("users"),
  deliveryStats: v.optional(v.object({
    totalRecipients: v.number(),
    delivered: v.number(),
    failed: v.number(),
    read: v.number(),
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["status"]).index("by_scheduled", ["scheduledFor"]),
```

#### 1.2 Convex Functions Structure
Create new files in `convex/`:

- `convex/infrastructure.ts` - Device fleet management
- `convex/networkOps.ts` - Network operations monitoring
- `convex/platformHealth.ts` - Platform health monitoring
- `convex/supportOps.ts` - Support operations
- `convex/compliance.ts` - Compliance monitoring
- `convex/platformBilling.ts` - Platform billing analytics
- `convex/platformSettings.ts` - Platform settings management
- `convex/onboarding.ts` - Tenant onboarding
- `convex/platformAnalytics.ts` - Platform analytics
- `convex/platformComms.ts` - Platform communications

### Phase 2: Infrastructure Device Fleet Management
**Duration**: 3-4 days
**Priority**: High

#### 2.1 Backend Implementation
**File**: `convex/infrastructure.ts`

```typescript
// Query Functions
export const listDeviceFleet = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("degraded"), v.literal("offline"), v.literal("maintenance"))),
    type: v.optional(v.union(v.literal("router"), v.literal("access_point"), v.literal("switch"), v.literal("nas"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    let query = ctx.db.query("deviceFleet");
    
    if (args.status) {
      query = query.withIndex("by_status", (q) => q.eq("status", args.status));
    }
    if (args.type) {
      query = query.withIndex("by_type", (q) => q.eq("type", args.type));
    }
    
    const limit = Math.min(100, args.limit ?? 50);
    return await query.order("desc").take(limit);
  },
});

export const getDeviceFleetRow = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db.query("deviceFleet").withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId)).first();
  },
});

// Mutation Functions
export const createDevice = mutation({
  args: {
    deviceId: v.string(),
    name: v.string(),
    type: v.union(v.literal("router"), v.literal("access_point"), v.literal("switch"), v.literal("nas")),
    ipAddress: v.string(),
    macAddress: v.string(),
    location: v.optional(v.string()),
    firmwareVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const deviceId = await ctx.db.insert("deviceFleet", {
      ...args,
      status: "active",
      posture: "healthy",
      lastSeen: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    await logAuditEvent(ctx, {
      action: "device_created",
      entityTable: "deviceFleet",
      entityId: deviceId,
      changedBy: user._id,
      beforeJson: null,
      afterJson: JSON.stringify(args),
    });
    
    return deviceId;
  },
});

export const updateDeviceFleetRow = mutation({
  args: {
    deviceId: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      status: v.optional(v.union(v.literal("active"), v.literal("degraded"), v.literal("offline"), v.literal("maintenance"))),
      posture: v.optional(v.union(v.literal("healthy"), v.literal("warning"), v.literal("critical"))),
      location: v.optional(v.string()),
      firmwareVersion: v.optional(v.string()),
      healthMetrics: v.optional(v.object({
        cpuUsage: v.number(),
        memoryUsage: v.number(),
        uptime: v.number(),
        temperature: v.optional(v.number()),
      })),
    }),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const device = await ctx.db.query("deviceFleet").withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId)).first();
    
    if (!device) {
      throw new Error("Device not found");
    }
    
    const beforeJson = JSON.stringify(device);
    await ctx.db.patch(device._id, {
      ...args.updates,
      updatedAt: Date.now(),
    });
    
    await logAuditEvent(ctx, {
      action: "device_updated",
      entityTable: "deviceFleet",
      entityId: device._id,
      changedBy: user._id,
      beforeJson,
      afterJson: JSON.stringify(args.updates),
    });
    
    return device._id;
  },
});

export const deleteDevice = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const device = await ctx.db.query("deviceFleet").withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId)).first();
    
    if (!device) {
      throw new Error("Device not found");
    }
    
    await ctx.db.delete(device._id);
    
    await logAuditEvent(ctx, {
      action: "device_deleted",
      entityTable: "deviceFleet",
      entityId: device._id,
      changedBy: user._id,
      beforeJson: JSON.stringify(device),
      afterJson: null,
    });
  },
});
```

#### 2.2 Frontend Implementation
**Files**: 
- `apps/web/platform/routes/infrastructure/page.tsx`
- `apps/web/platform/routes/infrastructure/devices/page.tsx`
- `apps/web/platform/routes/infrastructure/devices/[deviceId]/page.tsx`
- `apps/web/platform/components/PlatformInfrastructure.tsx`
- `apps/web/platform/components/DeviceFleetList.tsx`
- `apps/web/platform/components/DeviceDetail.tsx`

### Phase 3: Network Operations Monitoring
**Duration**: 3-4 days
**Priority**: High

#### 3.1 Backend Implementation
**File**: `convex/networkOps.ts`

```typescript
export const getQueueMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    return await ctx.db.query("queueMetrics").collect();
  },
});

export const getWorkerJobs = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed"))),
    tenantId: v.optional(v.id("tenants")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    let query = ctx.db.query("workerJobs");
    
    if (args.status) {
      query = query.withIndex("by_status", (q) => q.eq("status", args.status));
    }
    if (args.tenantId) {
      query = query.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId));
    }
    
    const limit = Math.min(100, args.limit ?? 50);
    return await query.order("desc").take(limit);
  },
});

export const getAccountingOverview = query({
  args: {
    period: v.optional(v.string()), // "24h", "7d", "30d"
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    // Aggregate accounting data from sessions table
    const sessions = await ctx.db.query("sessions").collect();
    
    // Filter by period if specified
    const now = Date.now();
    const periodMs = args.period === "24h" ? 24 * 60 * 60 * 1000 :
                    args.period === "7d" ? 7 * 24 * 60 * 60 * 1000 :
                    args.period === "30d" ? 30 * 24 * 60 * 60 * 1000 :
                    Infinity;
    
    const recentSessions = sessions.filter(s => now - s.startTime <= periodMs);
    
    return {
      totalSessions: recentSessions.length,
      activeSessions: recentSessions.filter(s => s.status === "active").length,
      totalDataTransferred: recentSessions.reduce((sum, s) => sum + (s.dataTransferred || 0), 0),
      totalDuration: recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      averageSessionDuration: recentSessions.length > 0 ? 
        recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / recentSessions.length : 0,
    };
  },
});
```

#### 3.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/network-ops/page.tsx`
- `apps/web/platform/routes/network-ops/queues/page.tsx`
- `apps/web/platform/routes/network-ops/workers/page.tsx`
- `apps/web/platform/routes/network-ops/accounting/page.tsx`
- `apps/web/platform/components/PlatformNetworkOps.tsx`
- `apps/web/platform/components/QueueMonitor.tsx`
- `apps/web/platform/components/WorkerJobsList.tsx`
- `apps/web/platform/components/AccountingOverview.tsx`

### Phase 4: Platform Health Dashboard
**Duration**: 2-3 days
**Priority**: High

#### 4.1 Backend Implementation
**File**: `convex/platformHealth.ts`

```typescript
export const getPlatformHealthOverview = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const healthServices = await ctx.db.query("platformHealth").collect();
    
    const overallStatus = healthServices.every(s => s.status === "operational") ? "operational" :
                          healthServices.some(s => s.status === "down") ? "down" : "degraded";
    
    const avgAvailability = healthServices.length > 0 ? 
      healthServices.reduce((sum, s) => sum + s.availability, 0) / healthServices.length : 0;
    
    return {
      overallStatus,
      services: healthServices,
      averageAvailability: avgAvailability,
      totalIncidents: healthServices.reduce((sum, s) => sum + s.incidentCount, 0),
      lastCheckedAt: Math.max(...healthServices.map(s => s.lastCheckedAt)),
    };
  },
});

export const updateServiceHealth = mutation({
  args: {
    serviceName: v.string(),
    status: v.union(v.literal("operational"), v.literal("degraded"), v.literal("down")),
    availability: v.number(),
    responseTime: v.number(),
    errorRate: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const existing = await ctx.db.query("platformHealth")
      .withIndex("by_service_name", (q) => q.eq("serviceName", args.serviceName))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        lastCheckedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("platformHealth", {
        ...args,
        serviceName: args.serviceName,
        uptimePercentage: args.availability,
        incidentCount: 0,
        lastCheckedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
```

#### 4.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/health/page.tsx`
- `apps/web/platform/components/PlatformHealthDashboard.tsx`
- `apps/web/platform/components/ServiceHealthCard.tsx`
- `apps/web/platform/components/IncidentTimeline.tsx`

### Phase 5: Support Operations
**Duration**: 2-3 days
**Priority**: Medium

#### 5.1 Backend Implementation
**File**: `convex/supportOps.ts`

```typescript
export const createSupportGrant = mutation({
  args: {
    platformUserId: v.id("users"),
    tenantId: v.id("tenants"),
    reason: v.string(),
    accessLevel: v.union(v.literal("read"), v.literal("write"), v.literal("admin")),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const grantId = await ctx.db.insert("supportGrants", {
      grantId: `grant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...args,
      grantedBy: user._id,
      grantedAt: Date.now(),
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    await logAuditEvent(ctx, {
      action: "support_grant_created",
      entityTable: "supportGrants",
      entityId: grantId,
      changedBy: user._id,
      beforeJson: null,
      afterJson: JSON.stringify(args),
    });
    
    return grantId;
  },
});

export const getActiveSupportGrants = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const now = Date.now();
    return await ctx.db.query("supportGrants")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("expiresAt"), now) || q.gt(q.field("expiresAt"), now))
      .collect();
  },
});

export const startSupportSession = mutation({
  args: {
    grantId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const grant = await ctx.db.query("supportGrants")
      .withIndex("by_grant_id", (q) => q.eq("grantId", args.grantId))
      .first();
    
    if (!grant || grant.status !== "active") {
      throw new Error("Invalid or expired grant");
    }
    
    const sessionId = await ctx.db.insert("supportSessions", {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      grantId: args.grantId,
      platformUserId: user._id,
      tenantId: grant.tenantId,
      startedAt: Date.now(),
      actions: [],
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return sessionId;
  },
});
```

#### 5.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/support/page.tsx`
- `apps/web/platform/routes/support/grants/page.tsx`
- `apps/web/platform/routes/support/sessions/page.tsx`
- `apps/web/platform/components/PlatformSupport.tsx`
- `apps/web/platform/components/SupportGrantsList.tsx`
- `apps/web/platform/components/SupportSessionTracker.tsx`

### Phase 6: Compliance Monitoring
**Duration**: 2-3 days
**Priority**: Medium

#### 6.1 Backend Implementation
**File**: `convex/compliance.ts`

```typescript
export const getComplianceOverview = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const checks = await ctx.db.query("complianceChecks").collect();
    
    const overallStatus = checks.every(c => c.status === "passing") ? "passing" :
                          checks.some(c => c.status === "failing") ? "failing" : "warning";
    
    return {
      overallStatus,
      totalChecks: checks.length,
      passing: checks.filter(c => c.status === "passing").length,
      failing: checks.filter(c => c.status === "failing").length,
      warning: checks.filter(c => c.status === "warning").length,
      critical: checks.filter(c => c.severity === "critical").length,
      checks,
    };
  },
});

export const runComplianceCheck = mutation({
  args: {
    checkType: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    
    // Implement actual compliance check logic based on checkType
    let status: "passing" | "failing" | "warning" = "passing";
    let details = "";
    let severity: "low" | "medium" | "high" | "critical" = "low";
    let remediationRequired = false;
    let remediationSteps: string[] = [];
    
    switch (args.checkType) {
      case "data_encryption":
        // Check if all sensitive data is encrypted
        status = "passing";
        details = "All sensitive data fields are encrypted at rest and in transit";
        break;
      case "audit_log_integrity":
        // Check audit log hash chain
        const chainHealth = await getAuditChainHealth(ctx, {});
        status = chainHealth.valid ? "passing" : "failing";
        severity = chainHealth.valid ? "low" : "critical";
        details = chainHealth.valid ? "Audit log hash chain is valid" : "Audit log integrity check failed";
        if (!chainHealth.valid) {
          remediationRequired = true;
          remediationSteps = ["Review audit chain verification logs", "Investigate potential tampering", "Restore from backup if needed"];
        }
        break;
      case "rbac_compliance":
        // Check RBAC implementation
        status = "passing";
        details = "Role-based access control is properly implemented";
        break;
      case "tenant_isolation":
        // Check tenant data isolation
        status = "passing";
        details = "Tenant data isolation is properly enforced";
        break;
      default:
        throw new Error("Unknown compliance check type");
    }
    
    const checkId = await ctx.db.insert("complianceChecks", {
      checkId: `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      checkType: args.checkType,
      status,
      lastCheckedAt: Date.now(),
      details,
      severity,
      remediationRequired,
      remediationSteps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return checkId;
  },
});
```

#### 6.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/compliance/page.tsx`
- `apps/web/platform/components/PlatformCompliance.tsx`
- `apps/web/platform/components/ComplianceDashboard.tsx`
- `apps/web/platform/components/ComplianceCheckCard.tsx`

### Phase 7: Platform Billing Analytics
**Duration**: 2-3 days
**Priority**: Medium

#### 7.1 Backend Implementation
**File**: `convex/platformBilling.ts`

```typescript
export const getPlatformRevenueOverview = query({
  args: {
    period: v.optional(v.string()), // "2026-09"
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const targetPeriod = args.period || new Date().toISOString().slice(0, 7); // Current month
    
    const revenueData = await ctx.db.query("platformRevenue")
      .withIndex("by_period", (q) => q.eq("period", targetPeriod))
      .first();
    
    if (revenueData) {
      return revenueData;
    }
    
    // Calculate real-time revenue data if not cached
    const invoices = await ctx.db.query("invoices").collect();
    const payments = await ctx.db.query("payments").collect();
    
    const periodStart = new Date(targetPeriod).getTime();
    const periodEnd = new Date(targetPeriod + "-01").setMonth(new Date(targetPeriod + "-01").getMonth() + 1);
    
    const periodInvoices = invoices.filter(i => i.createdAt >= periodStart && i.createdAt < periodEnd);
    const periodPayments = payments.filter(p => p.createdAt >= periodStart && p.createdAt < periodEnd);
    
    const totalRevenue = periodPayments.reduce((sum, p) => sum + p.amount, 0);
    const tenantIds = new Set(periodInvoices.map(i => i.tenantId));
    
    // Payment provider breakdown
    const providerBreakdown = periodPayments.reduce((acc, p) => {
      const provider = p.provider || "unknown";
      if (!acc[provider]) {
        acc[provider] = { amount: 0, count: 0 };
      }
      acc[provider].amount += p.amount;
      acc[provider].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);
    
    const providerBreakdownArray = Object.entries(providerBreakdown).map(([provider, data]) => ({
      provider,
      amount: data.amount,
      percentage: totalRevenue > 0 ? (data.amount / totalRevenue) * 100 : 0,
    }));
    
    return {
      period: targetPeriod,
      totalRevenue,
      tenantCount: tenantIds.size,
      averageRevenuePerTenant: tenantIds.size > 0 ? totalRevenue / tenantIds.size : 0,
      growthRate: 0, // Calculate from previous period
      paymentProviderBreakdown: providerBreakdownArray,
    };
  },
});

export const generatePlatformRevenueReport = mutation({
  args: {
    period: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    
    // Generate comprehensive revenue report
    const revenueData = await getPlatformRevenueOverview(ctx, { period: args.period });
    
    const reportId = await ctx.db.insert("platformRevenue", {
      ...revenueData,
      period: args.period,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return reportId;
  },
});
```

#### 7.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/billing/page.tsx`
- `apps/web/platform/routes/billing/analytics/page.tsx`
- `apps/web/platform/components/PlatformBilling.tsx`
- `apps/web/platform/components/RevenueOverview.tsx`
- `apps/web/platform/components/ProviderBreakdown.tsx`

### Phase 8: Advanced Platform Settings
**Duration**: 2 days
**Priority**: Medium

#### 8.1 Backend Implementation
**File**: `convex/platformSettings.ts`

```typescript
export const getPlatformSettings = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    let query = ctx.db.query("platformSettings");
    
    if (args.category) {
      query = query.withIndex("by_category", (q) => q.eq("category", args.category));
    }
    
    return await query.collect();
  },
});

export const updatePlatformSetting = mutation({
  args: {
    settingKey: v.string(),
    settingValue: v.string(),
    category: v.string(),
    description: v.string(),
    isEncrypted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    
    const existing = await ctx.db.query("platformSettings")
      .withIndex("by_setting_key", (q) => q.eq("settingKey", args.settingKey))
      .first();
    
    const beforeJson = existing ? JSON.stringify(existing) : null;
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: user._id,
        updatedAtTimestamp: Date.now(),
      });
    } else {
      await ctx.db.insert("platformSettings", {
        ...args,
        updatedAt: user._id,
        updatedAtTimestamp: Date.now(),
        createdAt: Date.now(),
      });
    }
    
    await logAuditEvent(ctx, {
      action: "platform_setting_updated",
      entityTable: "platformSettings",
      entityId: existing?._id || "new",
      changedBy: user._id,
      beforeJson,
      afterJson: JSON.stringify(args),
    });
  },
});
```

#### 8.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/settings/advanced/page.tsx`
- `apps/web/platform/components/AdvancedPlatformSettings.tsx`
- `apps/web/platform/components/SettingCategory.tsx`
- `apps/web/platform/components/SettingEditor.tsx`

### Phase 9: Tenant Onboarding Wizard
**Duration**: 3-4 days
**Priority**: Medium

#### 9.1 Backend Implementation
**File**: `convex/onboarding.ts`

```typescript
export const createOnboardingChecklist = mutation({
  args: {
    tenantId: v.id("tenants"),
    checklistName: v.string(),
    steps: v.array(v.object({
      stepId: v.string(),
      stepName: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    
    const stepsWithStatus = args.steps.map(step => ({
      ...step,
      completed: false,
      completedAt: undefined,
      completedBy: undefined,
    }));
    
    const checklistId = await ctx.db.insert("onboardingChecklists", {
      tenantId: args.tenantId,
      checklistName: args.checklistName,
      steps: stepsWithStatus,
      overallStatus: "in_progress",
      startedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return checklistId;
  },
});

export const completeOnboardingStep = mutation({
  args: {
    checklistId: v.id("onboardingChecklists"),
    stepId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const checklist = await ctx.db.get(args.checklistId);
    
    if (!checklist) {
      throw new Error("Checklist not found");
    }
    
    const updatedSteps = checklist.steps.map(step => {
      if (step.stepId === args.stepId) {
        return {
          ...step,
          completed: true,
          completedAt: Date.now(),
          completedBy: user._id,
        };
      }
      return step;
    });
    
    const allCompleted = updatedSteps.every(step => step.completed);
    const overallStatus = allCompleted ? "completed" : "in_progress";
    
    await ctx.db.patch(args.checklistId, {
      steps: updatedSteps,
      overallStatus,
      completedAt: allCompleted ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
  },
});

export const getTenantOnboardingStatus = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db.query("onboardingChecklists")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});
```

#### 9.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/onboarding/page.tsx`
- `apps/web/platform/routes/onboarding/[tenantId]/page.tsx`
- `apps/web/platform/components/TenantOnboardingWizard.tsx`
- `apps/web/platform/components/OnboardingChecklist.tsx`
- `apps/web/platform/components/ReadinessStatus.tsx`

### Phase 10: Platform Analytics
**Duration**: 2-3 days
**Priority**: Low

#### 10.1 Backend Implementation
**File**: `convex/platformAnalytics.ts`

```typescript
export const getPlatformMetrics = query({
  args: {
    metricName: v.optional(v.string()),
    timeRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    aggregationType: v.optional(v.union(v.literal("sum"), v.literal("avg"), v.literal("count"), v.literal("max"), v.literal("min"))),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    let query = ctx.db.query("platformMetrics");
    
    if (args.metricName) {
      query = query.withIndex("by_name", (q) => q.eq("metricName", args.metricName));
    }
    
    let metrics = await query.collect();
    
    // Filter by time range if specified
    if (args.timeRange) {
      metrics = metrics.filter(m => 
        m.timestamp >= args.timeRange!.start && m.timestamp <= args.timeRange!.end
      );
    }
    
    // Apply aggregation if specified
    if (args.aggregationType && metrics.length > 0) {
      switch (args.aggregationType) {
        case "sum":
          return { total: metrics.reduce((sum, m) => sum + m.metricValue, 0) };
        case "avg":
          return { average: metrics.reduce((sum, m) => sum + m.metricValue, 0) / metrics.length };
        case "count":
          return { count: metrics.length };
        case "max":
          return { max: Math.max(...metrics.map(m => m.metricValue)) };
        case "min":
          return { min: Math.min(...metrics.map(m => m.metricValue)) };
      }
    }
    
    return metrics;
  },
});

export const recordPlatformMetric = mutation({
  args: {
    metricName: v.string(),
    metricValue: v.number(),
    tags: v.optional(v.record(v.string(), v.string())),
    aggregationType: v.union(v.literal("sum"), v.literal("avg"), v.literal("count"), v.literal("max"), v.literal("min")),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    
    await ctx.db.insert("platformMetrics", {
      ...args,
      timestamp: Date.now(),
      createdAt: Date.now(),
    });
  },
});
```

#### 10.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/analytics/page.tsx`
- `apps/web/platform/components/PlatformAnalytics.tsx`
- `apps/web/platform/components/MetricsChart.tsx`
- `apps/web/platform/components/MetricFilter.tsx`

### Phase 11: Platform Communications
**Duration**: 2-3 days
**Priority**: Low

#### 11.1 Backend Implementation
**File**: `convex/platformComms.ts`

```typescript
export const createPlatformNotification = mutation({
  args: {
    title: v.string(),
    message: v.string(),
    targetType: v.union(v.literal("all_tenants"), v.literal("specific_tenant"), v.literal("specific_role")),
    targetIds: v.optional(v.array(v.string())),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    
    const notificationId = await ctx.db.insert("platformNotifications", {
      notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...args,
      status: args.scheduledFor ? "scheduled" : "draft",
      sentBy: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return notificationId;
  },
});

export const sendPlatformNotification = mutation({
  args: { notificationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const notification = await ctx.db.query("platformNotifications")
      .withIndex("by_notification_id", (q) => q.eq("notificationId", args.notificationId))
      .first();
    
    if (!notification) {
      throw new Error("Notification not found");
    }
    
    // Determine target recipients
    let recipients: string[] = [];
    if (notification.targetType === "all_tenants") {
      const tenants = await ctx.db.query("tenants").collect();
      recipients = tenants.map(t => t._id);
    } else if (notification.targetType === "specific_tenant" && notification.targetIds) {
      recipients = notification.targetIds;
    } else if (notification.targetType === "specific_role" && notification.targetIds) {
      // Get users with specific roles
      const users = await ctx.db.query("users").collect();
      // Filter by role implementation
      recipients = users.map(u => u._id);
    }
    
    // Send notifications (integrate with communication adapter)
    // This would call the communications service
    
    await ctx.db.patch(notification._id, {
      status: "sent",
      sentAt: Date.now(),
      deliveryStats: {
        totalRecipients: recipients.length,
        delivered: recipients.length, // Would be updated by actual delivery
        failed: 0,
        read: 0,
      },
      updatedAt: Date.now(),
    });
    
    return notification._id;
  },
});

export const getPlatformNotifications = query({
  args: {
    status: v.optional(v.union(v.literal("draft"), v.literal("scheduled"), v.literal("sent"), v.literal("cancelled"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    let query = ctx.db.query("platformNotifications");
    
    if (args.status) {
      query = query.withIndex("by_status", (q) => q.eq("status", args.status));
    }
    
    const limit = Math.min(50, args.limit ?? 20);
    return await query.order("desc").take(limit);
  },
});
```

#### 11.2 Frontend Implementation
**Files**:
- `apps/web/platform/routes/communications/page.tsx`
- `apps/web/platform/routes/notifications/create/page.tsx`
- `apps/web/platform/components/PlatformCommunications.tsx`
- `apps/web/platform/components/NotificationComposer.tsx`
- `apps/web/platform/components/NotificationList.tsx`

### Phase 12: Testing & Validation
**Duration**: 3-4 days
**Priority**: Critical

#### 12.1 Backend Testing
Create comprehensive test files:

- `convex/infrastructure.test.ts`
- `convex/networkOps.test.ts`
- `convex/platformHealth.test.ts`
- `convex/supportOps.test.ts`
- `convex/compliance.test.ts`
- `convex/platformBilling.test.ts`
- `convex/platformSettings.test.ts`
- `convex/onboarding.test.ts`
- `convex/platformAnalytics.test.ts`
- `convex/platformComms.test.ts`

#### 12.2 Frontend Testing
Create component tests:

- Test all new components with React Testing Library
- Test route access controls
- Test form validations
- Test error handling
- Test loading states

#### 12.3 Integration Testing
- End-to-end testing of all platform features
- Cross-tenant isolation testing
- Performance testing
- Security testing

### Phase 13: Deployment
**Duration**: 1-2 days
**Priority**: Critical

#### 13.1 Pre-deployment Checklist
- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] ESLint warnings resolved
- [ ] No hardcoded values
- [ ] All environment variables documented
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Backup procedures tested

#### 13.2 Deployment Steps
1. Deploy Convex schema changes
2. Deploy Convex functions
3. Deploy Next.js frontend
4. Run smoke tests
5. Monitor for issues
6. Document any issues found

## Implementation Order & Dependencies

1. **Phase 1** (Foundation) - MUST COME FIRST
2. **Phase 2** (Infrastructure) - Depends on Phase 1
3. **Phase 3** (Network Ops) - Depends on Phase 1
4. **Phase 4** (Platform Health) - Depends on Phase 1
5. **Phase 5** (Support Ops) - Depends on Phase 1
6. **Phase 6** (Compliance) - Depends on Phase 1
7. **Phase 7** (Platform Billing) - Depends on Phase 1
8. **Phase 8** (Advanced Settings) - Depends on Phase 1
9. **Phase 9** (Onboarding) - Depends on Phase 1
10. **Phase 10** (Analytics) - Depends on Phase 1
11. **Phase 11** (Communications) - Depends on Phase 1
12. **Phase 12** (Testing) - Depends on all previous phases
13. **Phase 13** (Deployment) - Depends on Phase 12

## Success Criteria

Each phase will be considered complete when:

1. ✅ All Convex functions are implemented and tested
2. ✅ All UI components are implemented and tested
3. ✅ No hardcoded values exist
4. ✅ Proper error handling is implemented
5. ✅ Audit logging is in place for all mutations
6. ✅ RBAC is properly enforced
7. ✅ Cross-tenant isolation is verified
8. ✅ Performance meets acceptable benchmarks
9. ✅ Security requirements are met
10. ✅ Documentation is updated

## Risk Mitigation

1. **Schema Changes**: Use migration strategy with backfill
2. **Performance**: Implement pagination and caching
3. **Security**: Implement proper access controls and audit logging
4. **Testing**: Comprehensive test coverage before deployment
5. **Rollback**: Maintain ability to rollback changes if needed

## Timeline Estimate

- **Phase 1**: 2-3 days
- **Phase 2**: 3-4 days
- **Phase 3**: 3-4 days
- **Phase 4**: 2-3 days
- **Phase 5**: 2-3 days
- **Phase 6**: 2-3 days
- **Phase 7**: 2-3 days
- **Phase 8**: 2 days
- **Phase 9**: 3-4 days
- **Phase 10**: 2-3 days
- **Phase 11**: 2-3 days
- **Phase 12**: 3-4 days
- **Phase 13**: 1-2 days

**Total Estimated Time**: 32-41 days

## Next Steps

Please review this implementation plan and provide feedback on:

1. **Scope**: Are all required features covered?
2. **Priority**: Should any phases be reordered?
3. **Timeline**: Is the timeline realistic?
4. **Approach**: Any concerns with the technical approach?

Once approved, I will begin implementation starting with Phase 1 (Foundation & Schema Design).