import assert from "node:assert/strict";
import { get, list, update } from "@/convex/subscribers";
import { getCurrentWorkspace } from "@/convex/tenantControl";

type Row = Record<string, unknown> & { _id: string; _creationTime?: number };
type IndexFilter = { eq: (field: string, value: unknown) => IndexFilter };
type MockQuery = {
  withIndex: (name: string, build: (filter: IndexFilter) => IndexFilter) => MockQuery;
  order: (direction: string) => MockQuery;
  first: () => Promise<Row | null>;
  collect: () => Promise<Row[]>;
};
type MockCtx = {
  db: {
    get: (id: string) => Promise<Row | null>;
    patch: (id: string, updates: Record<string, unknown>) => Promise<void>;
    query: (table: string) => MockQuery;
  };
  auth: {
    getUserIdentity: () => Promise<{ subject: string; email: string; org_id: string }>;
  };
};

const tenantA = {
  _id: "tenant_a",
  name: "A Network",
  slug: "a-network",
  status: "active",
  country: "KE",
  timezone: "Africa/Nairobi",
  currency: "KES",
  workosOrganizationId: "org_alpha",
};
const tenantB = {
  _id: "tenant_b",
  name: "B Network",
  slug: "b-network",
  status: "active",
  country: "UG",
  timezone: "Africa/Kampala",
  currency: "UGX",
  workosOrganizationId: "org_bravo",
};
const userA = {
  _id: "user_a",
  workosUserId: "user_alpha",
  email: "alpha@example.test",
  isActive: true,
};
const subscriberA = {
  _id: "subscriber_a",
  tenantId: tenantA._id,
  name: "A customer",
  accountNumber: "A-001",
  phone: "+254700000001",
  connectionType: "pppoe",
  status: "active",
};
const subscriberB = {
  _id: "subscriber_b",
  tenantId: tenantB._id,
  name: "B customer",
  accountNumber: "B-001",
  phone: "+256700000001",
  connectionType: "pppoe",
  status: "active",
};

const asHandler = <Result>(fn: unknown) =>
  (fn as { _handler: (ctx: MockCtx, args: Record<string, unknown>) => Promise<Result> })._handler;

function makeCtx({
  orgId = "org_alpha",
  tenantStatus = "active",
  membershipStatus = "active",
}: {
  orgId?: string;
  tenantStatus?: string;
  membershipStatus?: string;
} = {}): MockCtx & { patched: string[] } {
  const tenants = [
    { ...tenantA, status: tenantStatus },
    tenantB,
  ];
  const memberships = [
    { _id: "membership_a", userId: userA._id, tenantId: tenantA._id, role: "tenant_admin", status: membershipStatus },
    { _id: "membership_b", userId: userA._id, tenantId: tenantB._id, role: "tenant_admin", status: "active" },
  ];
  const subscribers = [subscriberA, subscriberB];
  const markets = [
    { _id: "market_a", tenantId: tenantA._id, status: "active", lifecycleStatus: "active" },
    { _id: "market_b", tenantId: tenantB._id, status: "active", lifecycleStatus: "active" },
  ];
  const rows: Record<string, Row[]> = {
    tenants,
    users: [userA],
    tenantMemberships: memberships,
    subscribers,
    markets,
    entitlements: [],
  };
  const patched: string[] = [];

  const db: MockCtx["db"] = {
    get: async (id: string) => Object.values(rows).flat().find((row) => row._id === id) ?? null,
    patch: async (id: string) => { patched.push(id); },
    query: (table: string) => {
      let result = [...(rows[table] ?? [])];
      const query: MockQuery = {
        withIndex: (_index: string, build: (q: IndexFilter) => IndexFilter) => {
          const conditions: [string, unknown][] = [];
          const filter: IndexFilter = {
            eq: (field, value) => {
              conditions.push([field, value]);
              return filter;
            },
          };
          build(filter);
          result = result.filter((row) => conditions.every(([field, value]) => row[field] === value));
          return query;
        },
        order: (direction: string) => { void direction; return query; },
        first: async () => result[0] ?? null,
        collect: async () => result,
      };
      return query;
    },
  };

  return {
    db,
    patched,
    auth: { getUserIdentity: async () => ({ subject: userA.workosUserId, email: userA.email, org_id: orgId }) },
  };
}

test("workspace resolves only the caller's active tenant and its market count", async () => {
  const result = await asHandler<{ status: string; workspace: { tenant: Row; activeMarkets: number } }>(getCurrentWorkspace)(makeCtx(), {});
  assert.equal(result.status, "ready");
  assert.equal(result.workspace.tenant._id, tenantA._id);
  assert.equal(result.workspace.activeMarkets, 1);
});

test("workspace fails closed for a suspended tenant and an inactive membership", async () => {
  const suspended = await asHandler<{ status: string; reason: string }>(getCurrentWorkspace)(makeCtx({ tenantStatus: "suspended" }), {});
  assert.deepEqual(suspended, { status: "setup_required", reason: "tenant_suspended" });

  const inactiveMember = await asHandler<{ status: string; reason: string }>(getCurrentWorkspace)(makeCtx({ membershipStatus: "revoked" }), {});
  assert.deepEqual(inactiveMember, { status: "setup_required", reason: "tenant_membership_required" });
});

test("subscriber list and direct reads cannot expose another tenant's records", async () => {
  const ctx = makeCtx();
  const rows = await asHandler<Row[]>(list)(ctx, {});
  assert.deepEqual(rows.map((row: Row) => row._id), [subscriberA._id]);
  assert.equal(await asHandler<Row | null>(get)(ctx, { id: subscriberB._id }), null);
  assert.equal((await asHandler<Row | null>(get)(ctx, { id: subscriberA._id }))?._id, subscriberA._id);
});

test("subscriber update rejects a foreign tenant record without mutating it", async () => {
  const ctx = makeCtx();
  await assert.rejects(
    asHandler(update)(ctx, { id: subscriberB._id, name: "Changed by tenant A" }),
    /Subscriber not found/,
  );
  assert.deepEqual(ctx.patched, []);
});
