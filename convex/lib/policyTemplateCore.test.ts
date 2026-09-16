import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPolicyTemplateKind,
  isPolicyTemplateStatus,
  isPolicyVersionFrozen,
  isValidPolicyTemplateCode,
  isValidPolicyTemplateName,
  isValidRateMbps,
  isValidBurstMbps,
  nextPolicyTemplateVersion,
  buildPolicyTemplateRow,
  latestVersionPerFamily,
  type PolicyTemplateKind,
  type PolicyTemplateStatus,
} from "./policyTemplateCore.ts";

describe("policyTemplateCore", () => {
  describe("isPolicyTemplateKind", () => {
    it("accepts valid kinds", () => {
      assert.ok(isPolicyTemplateKind("pppoe"));
      assert.ok(isPolicyTemplateKind("rate_limit"));
    });
    it("rejects unknown kind", () => {
      assert.ok(!isPolicyTemplateKind("unknown"));
      assert.ok(!isPolicyTemplateKind(""));
    });
  });

  describe("isPolicyTemplateStatus", () => {
    it("accepts valid statuses", () => {
      assert.ok(isPolicyTemplateStatus("draft"));
      assert.ok(isPolicyTemplateStatus("published"));
      assert.ok(isPolicyTemplateStatus("retired"));
    });
    it("rejects unknown status", () => {
      assert.ok(!isPolicyTemplateStatus("archived"));
      assert.ok(!isPolicyTemplateStatus(""));
    });
  });

  describe("isPolicyVersionFrozen", () => {
    it("draft is editable", () => {
      assert.ok(!isPolicyVersionFrozen("draft"));
    });
    it("published and retired are frozen", () => {
      assert.ok(isPolicyVersionFrozen("published"));
      assert.ok(isPolicyVersionFrozen("retired"));
    });
  });

  describe("isValidPolicyTemplateCode", () => {
    it("accepts valid slugs", () => {
      assert.ok(isValidPolicyTemplateCode("pppoe-standard"));
      assert.ok(isValidPolicyTemplateCode("rate10m"));
      assert.ok(isValidPolicyTemplateCode("a1"));
    });
    it("rejects too short or invalid chars", () => {
      assert.ok(!isValidPolicyTemplateCode("a"));
      assert.ok(!isValidPolicyTemplateCode("UPPERCASE"));
      assert.ok(!isValidPolicyTemplateCode("-leading"));
      assert.ok(!isValidPolicyTemplateCode("has space"));
    });
  });

  describe("isValidPolicyTemplateName", () => {
    it("accepts 3-80 chars", () => {
      assert.ok(isValidPolicyTemplateName("abc"));
      assert.ok(isValidPolicyTemplateName("pppoe standard 10mbps"));
    });
    it("rejects too short or empty", () => {
      assert.ok(!isValidPolicyTemplateName("ab"));
      assert.ok(!isValidPolicyTemplateName("  "));
    });
  });

  describe("isValidRateMbps", () => {
    it("accepts valid rates", () => {
      assert.ok(isValidRateMbps(1));
      assert.ok(isValidRateMbps(100));
      assert.ok(isValidRateMbps(1_000_000));
    });
    it("rejects invalid values", () => {
      assert.ok(!isValidRateMbps(0));
      assert.ok(!isValidRateMbps(-1));
      assert.ok(!isValidRateMbps(NaN));
      assert.ok(!isValidRateMbps(Infinity));
      assert.ok(!isValidRateMbps(1_000_001));
    });
  });

  describe("isValidBurstMbps", () => {
    it("accepts defined valid bursts and undefined", () => {
      assert.ok(isValidBurstMbps(undefined));
      assert.ok(isValidBurstMbps(0));
      assert.ok(isValidBurstMbps(50));
    });
    it("rejects negative burst", () => {
      assert.ok(!isValidBurstMbps(-1));
    });
  });

  describe("nextPolicyTemplateVersion", () => {
    it("yields 1 for a fresh family", () => {
      assert.equal(nextPolicyTemplateVersion(null), 1);
    });
    it("increments existing max", () => {
      assert.equal(nextPolicyTemplateVersion(1), 2);
      assert.equal(nextPolicyTemplateVersion(5), 6);
    });
  });

  describe("buildPolicyTemplateRow", () => {
    it("produces deterministic row with defaults", () => {
      const row = buildPolicyTemplateRow({
        _id: "tpl123",
        code: "pppoe-standard",
        name: "PPPoE Standard",
        version: 3,
        kind: "pppoe" as PolicyTemplateKind,
        downloadMbps: 10,
        uploadMbps: 5,
        status: "published" as PolicyTemplateStatus,
      });
      assert.equal(row._id, "tpl123");
      assert.equal(row.code, "pppoe-standard");
      assert.equal(row.version, 3);
      assert.equal(row.burstDownloadMbps, null);
      assert.equal(row.burstUploadMbps, null);
      assert.equal(row.description, null);
    });
    it("preserves burst fields when provided", () => {
      const row = buildPolicyTemplateRow({
        _id: "tpl456",
        code: "rate-limit-100",
        name: "Rate Limit 100",
        version: 1,
        kind: "rate_limit" as PolicyTemplateKind,
        downloadMbps: 100,
        uploadMbps: 100,
        burstDownloadMbps: 120,
        burstUploadMbps: 110,
        status: "draft" as PolicyTemplateStatus,
      });
      assert.equal(row.burstDownloadMbps, 120);
      assert.equal(row.burstUploadMbps, 110);
    });
  });

  describe("latestVersionPerFamily", () => {
    it("returns latest per code", () => {
      const latest = latestVersionPerFamily([
        { _id: "a1", code: "a", version: 1 },
        { _id: "a2", code: "a", version: 3 },
        { _id: "a1b", code: "a", version: 2 },
        { _id: "b1", code: "b", version: 1 },
      ]);
      assert.equal(latest.size, 2);
      assert.equal(latest.get("a")?.latestVersion, 3);
      assert.equal(latest.get("a")?.latestId, "a2");
      assert.equal(latest.get("b")?.latestVersion, 1);
      assert.equal(latest.get("b")?.latestId, "b1");
    });
    it("handles empty array", () => {
      assert.equal(latestVersionPerFamily([]).size, 0);
    });
  });
});
