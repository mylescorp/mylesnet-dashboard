import assert from "node:assert/strict";
import { test } from "node:test";
import { omitUndefinedFields, validatePolicy, type PolicyFields } from "./platformPolicyTemplateCore.ts";

const valid: PolicyFields = {
  downloadMbps: 20, uploadMbps: 5, concurrentSessions: 3, deviceLimit: 2,
  staticIpAllowed: false, dnsServers: [], serviceEnabled: false,
};

test("policy templates accept complete required limits with optional fields omitted", () => {
  assert.doesNotThrow(() => validatePolicy(valid));
  assert.deepEqual(omitUndefinedFields({ required: 1, optional: undefined }), { required: 1 });
});

test("policy templates reject invalid speeds, session limits, DNS, and incomplete optional groups", () => {
  for (const fields of [
    { ...valid, downloadMbps: 0 },
    { ...valid, uploadMbps: 10001 },
    { ...valid, concurrentSessions: 1.5 },
    { ...valid, dnsServers: ["https://resolver.invalid"] },
    { ...valid, burstThresholdPercent: 80 },
    { ...valid, fairUseAfterGb: 10, fairUseDownloadMbps: 5 },
    { ...valid, scheduleStart: "22:00" },
  ]) assert.throws(() => validatePolicy(fields));
});

test("policy templates enforce VLAN, paired burst rates, and valid schedules", () => {
  assert.throws(() => validatePolicy({ ...valid, vlanId: 4095 }));
  assert.throws(() => validatePolicy({ ...valid, burstDownloadMbps: 30 }));
  assert.throws(() => validatePolicy({ ...valid, scheduleStart: "24:00", scheduleEnd: "06:00" }));
  assert.doesNotThrow(() => validatePolicy({ ...valid, burstDownloadMbps: 30, burstUploadMbps: 8, burstThresholdPercent: 70, burstWindowSeconds: 60, scheduleStart: "22:00", scheduleEnd: "06:00" }));
});
