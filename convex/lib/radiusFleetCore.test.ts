import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isRadiusServerStatus,
  isRadiusServerProtocol,
  isRadiusHealthStatus,
  isValidRadiusHostname,
  isValidRadiusPort,
  buildRadiusServerRow,
  type RadiusServerProtocol,
} from "./radiusFleetCore.ts";

describe("radiusFleetCore", () => {
  describe("isRadiusServerStatus", () => {
    it("accepts valid statuses", () => {
      assert.ok(isRadiusServerStatus("active"));
      assert.ok(isRadiusServerStatus("provisioning"));
      assert.ok(isRadiusServerStatus("failed"));
      assert.ok(isRadiusServerStatus("maintenance"));
      assert.ok(isRadiusServerStatus("decommissioned"));
    });

    it("rejects unknown status", () => {
      assert.ok(!isRadiusServerStatus("unknown"));
      assert.ok(!isRadiusServerStatus(""));
    });
  });

  describe("isRadiusServerProtocol", () => {
    it("accepts valid protocols", () => {
      assert.ok(isRadiusServerProtocol("radsec"));
      assert.ok(isRadiusServerProtocol("udp"));
    });

    it("rejects unknown protocol", () => {
      assert.ok(!isRadiusServerProtocol("tcp"));
      assert.ok(!isRadiusServerProtocol(""));
    });
  });

  describe("isRadiusHealthStatus", () => {
    it("accepts valid health statuses", () => {
      assert.ok(isRadiusHealthStatus("healthy"));
      assert.ok(isRadiusHealthStatus("degraded"));
      assert.ok(isRadiusHealthStatus("down"));
      assert.ok(isRadiusHealthStatus("unknown"));
    });

    it("rejects unknown health status", () => {
      assert.ok(!isRadiusHealthStatus("flapping"));
    });
  });

  describe("isValidRadiusHostname", () => {
    it("accepts IPv4 addresses", () => {
      assert.ok(isValidRadiusHostname("10.0.1.50"));
      assert.ok(isValidRadiusHostname("192.168.1.1"));
    });

    it("accepts IPv6 addresses in brackets", () => {
      assert.ok(isValidRadiusHostname("[::1]"));
      assert.ok(isValidRadiusHostname("[2001:db8::1]"));
    });

    it("accepts valid hostnames", () => {
      assert.ok(isValidRadiusHostname("radius1.example.com"));
      assert.ok(isValidRadiusHostname("nas-ct-01"));
    });

    it("rejects empty and whitespace", () => {
      assert.ok(!isValidRadiusHostname(""));
      assert.ok(!isValidRadiusHostname(" "));
      assert.ok(!isValidRadiusHostname("radius node"));
    });

    it("rejects suspicious characters", () => {
      assert.ok(!isValidRadiusHostname("node; rm -rf /"));
      assert.ok(!isValidRadiusHostname("node$(whoami)"));
    });

    it("rejects names starting or ending with non-alphanumeric", () => {
      assert.ok(!isValidRadiusHostname("-radius"));
      assert.ok(!isValidRadiusHostname("radius-"));
    });
  });

  describe("isValidRadiusPort", () => {
    it("accepts valid ports", () => {
      assert.ok(isValidRadiusPort(1812));
      assert.ok(isValidRadiusPort(1813));
      assert.ok(isValidRadiusPort(2083));
      assert.ok(isValidRadiusPort(1));
      assert.ok(isValidRadiusPort(65535));
    });

    it("rejects out-of-range and non-integer", () => {
      assert.ok(!isValidRadiusPort(0));
      assert.ok(!isValidRadiusPort(65536));
      assert.ok(!isValidRadiusPort(1812.5));
      assert.ok(!isValidRadiusPort(NaN));
      assert.ok(!isValidRadiusPort(Infinity));
    });
  });

  describe("buildRadiusServerRow", () => {
    it("produces deterministic row with defaults", () => {
      const row = buildRadiusServerRow({
        _id: "server123",
        name: "RADIUS Node 1",
        hostname: "10.0.1.50",
        port: 1812,
        protocol: "radsec" as RadiusServerProtocol,
        status: "active",
        healthStatus: "healthy",
      });

      assert.equal(row._id, "server123");
      assert.equal(row.name, "RADIUS Node 1");
      assert.equal(row.hostname, "10.0.1.50");
      assert.equal(row.port, 1812);
      assert.equal(row.protocol, "radsec");
      assert.equal(row.status, "active");
      assert.equal(row.healthStatus, "healthy");
      assert.equal(row.region, null);
      assert.equal(row.certExpiryAt, null);
      assert.equal(row.lastHealthCheckAt, null);
      assert.equal(row.notes, null);
      assert.equal(row.registeredBy, null);
      assert.equal(row.createdAt, null);
    });

    it("preserves all optional fields when provided", () => {
      const now = Date.now();
      const row = buildRadiusServerRow({
        _id: "server456",
        name: "RADIUS Node 2",
        hostname: "192.168.1.1",
        port: 2083,
        protocol: "udp",
        status: "provisioning",
        healthStatus: "unknown",
        region: "aws-cape-town",
        certExpiryAt: now + 86400000,
        lastHealthCheckAt: now,
        notes: "Primary authentication node",
        registeredBy: "user123",
        createdAt: now - 1000,
      });

      assert.equal(row.region, "aws-cape-town");
      assert.equal(row.certExpiryAt, now + 86400000);
      assert.equal(row.lastHealthCheckAt, now);
      assert.equal(row.notes, "Primary authentication node");
      assert.equal(row.registeredBy, "user123");
      assert.equal(row.createdAt, now - 1000);
    });
  });
});
