import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlatformRadiusInput } from "./platformRadiusCore.ts";

const valid = {
  name: "Nairobi AAA-1", hostname: "radius-1.internal.example", region: "af-south-1",
  authPort: 1812, accountingPort: 1813, transport: "udp" as const,
  lifecycleStatus: "planned" as const, capacitySessions: 100_000,
};

test("RADIUS server input normalizes metadata and accepts valid endpoint settings", () => {
  assert.deepEqual(validatePlatformRadiusInput({ ...valid, name: " Nairobi AAA-1 ", hostname: "radius-1.internal.example." }), { ...valid, name: "Nairobi AAA-1", hostname: "radius-1.internal.example" });
});

test("RADIUS server input rejects URLs, invalid ports, duplicate ports, and invalid capacity", () => {
  for (const input of [
    { ...valid, hostname: "https://radius.internal" },
    { ...valid, authPort: 0 },
    { ...valid, authPort: 1812.5 },
    { ...valid, accountingPort: 1812 },
    { ...valid, capacitySessions: -1 },
  ]) assert.throws(() => validatePlatformRadiusInput(input));
});
