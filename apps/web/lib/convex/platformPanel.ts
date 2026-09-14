import { makeFunctionReference } from "convex/server";

/**
 * Client-side bindings for the Platform panel surfaces that live in
 * `convex/platform.ts` but are not yet in the pinned generated `api`.
 * Keep in sync — never regenerate bindings until the Convex target is
 * explicitly verified (see apps/web/lib/convex/tenantControl.ts).
 */

export type AuditLogEntry = {
  _id: string;
  action: string;
  entityTable: string;
  entityId: string;
  changedBy: string;
  beforeJson?: string;
  afterJson?: string;
  timestamp: number;
  ip?: string;
};

export type AuditLogPage = {
  items: AuditLogEntry[];
  nextCursor: string | null;
};

export type AuditChainHealth = {
  valid: boolean;
  checkedEntries: number;
  issue?: "invalid_genesis" | "missing_link" | "invalid_sequence" | "invalid_hash";
  sealedEntries: number;
  legacyEntriesInWindow: number;
  windowSize: number;
  windowLimited: boolean;
  startsAt: number | null;
  endsAt: number | null;
  firstSequence: number | null;
  lastSequence: number | null;
};

export type SecurityStaffEntry = {
  userId: string;
  name: string | null;
  email: string | null;
  roles: string[];
  mandatoryMfa: boolean;
  mfaEnrolled: boolean;
  mfaEnrolledAt: number | null;
  compliance: "compliant" | "missing_mfa" | "n/a";
};

export type PlatformSecurityOverview = {
  tenantOverview: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    cancelled: number;
    identityMapped: number;
  };
  staff: SecurityStaffEntry[];
  staffMissingMfa: number;
  workosEvents: { received: number; completed: number; retry: number; quarantined: number };
  deliveries24h: { total: number; processed: number; signatureInvalid: number };
  featureFlags: Record<string, boolean>;
  currentUserId: string;
};

export const platformPanel = {
  listAuditLogPage: makeFunctionReference<"query", {
    entityTable?: string;
    limit?: number;
    cursor?: string | null;
  }, AuditLogPage>("platform:listAuditLogPage"),
  listAuditEntityTables: makeFunctionReference<"query", Record<string, never>, string[]>("platform:listAuditEntityTables"),
  getAuditChainHealth: makeFunctionReference<"query", Record<string, never>, AuditChainHealth>("platform:getAuditChainHealth"),
  getPlatformSecurityOverview: makeFunctionReference<"query", Record<string, never>, PlatformSecurityOverview>("platform:getPlatformSecurityOverview"),
};
