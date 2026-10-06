import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFleetRow,
  isProvisioningStatusValue,
  isUptimePercentValid,
  type FleetMergeInput,
} from "./fleetCore.ts";

const device = (overrides: Partial<FleetMergeInput> = {}): FleetMergeInput => ({
  _id: "dev1",
  marketId: "market1",
  marketName: "Nairobi",
  name: "CORE-01",
  deviceKind: "mikrotik",
  lifecycleStatus: "active",
  ...overrides,
});

test("buildFleetRow maps the raw device into a flat, serializable row", () => {
  const row = buildFleetRow(
    device({
      _id: "dev1",
      tenantId: "tenantA",
      marketId: "market1",
      name: "CORE-01",
      deviceKind: "mikrotik",
      firmwareVersion: "v6.49.10",
      lastSeenAt: 1700000000000,
      uptimePercent: 99.7,
      provisioningStatus: "provisioned",
      lifecycleStatus: "active",
    }),
    "tenantA",
    "Acme ISP",
  );
  assert.equal(row._id, "dev1");
  assert.equal(row.tenantId, "tenantA");
  assert.equal(row.tenantName, "Acme ISP");
  assert.equal(row.marketId, "market1");
  assert.equal(row.marketName, "Nairobi");
  assert.equal(row.firmwareVersion, "v6.49.10");
  assert.equal(row.lastSeenAt, 1700000000000);
  assert.equal(row.uptimePercent, 99.7);
  assert.equal(row.provisioningStatus, "provisioned");
});

test("absent optional fields resolve to null, not undefined", () => {
  const row = buildFleetRow(device(), "tenantA", "Acme ISP");
  assert.equal(row.tenantName, "Acme ISP");
  assert.equal(row.marketName, "Nairobi");
  assert.equal(row.firmwareVersion, null);
  assert.equal(row.lastSeenAt, null);
  assert.equal(row.uptimePercent, null);
  assert.equal(row.provisioningStatus, null);
  assert.equal(row.registeredAt, null);
});

test("an unknown tenant id/name never leaks another tenant's identity", () => {
  // The device's tenant is "tenantA"; a look-up keyed by that id MUST NOT
  // fall back to a different tenant record even if a sibling tenant exists.
  const row = buildFleetRow(device({ tenantId: "tenantA" }), "tenantA", "Acme ISP");
  assert.equal(row.tenantId, "tenantA");
  assert.equal(row.tenantName, "Acme ISP");
  assert.notEqual(row.tenantName, "Sibling ISP");
  assert.notEqual(row.tenantName, null);
});

test("a device with no tenant id inherits the market tenant, with its name", () => {
  const row = buildFleetRow(device({ tenantId: undefined }), "marketTenant", "MarkerCo");
  assert.equal(row.tenantId, "marketTenant");
  assert.equal(row.tenantName, "MarkerCo");
});

test("uptimePercent must be a finite percentage in 0..100, absent allowed", () => {
  assert.equal(isUptimePercentValid(undefined), true);
  assert.equal(isUptimePercentValid(0), true);
  assert.equal(isUptimePercentValid(100), true);
  assert.equal(isUptimePercentValid(99.7), true);
  assert.equal(isUptimePercentValid(-1), false);
  assert.equal(isUptimePercentValid(100.1), false);
  assert.equal(isUptimePercentValid(Number.NaN), false);
  assert.equal(isUptimePercentValid(Number.POSITIVE_INFINITY), false);
});

test("provisioningStatus only admits the four fleet states", () => {
  assert.equal(isProvisioningStatusValue("unprovisioned"), true);
  assert.equal(isProvisioningStatusValue("pending"), true);
  assert.equal(isProvisioningStatusValue("provisioned"), true);
  assert.equal(isProvisioningStatusValue("failed"), true);
  assert.equal(isProvisioningStatusValue("active"), false);
  assert.equal(isProvisioningStatusValue(""), false);
});