import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLATFORM_SESSION_POLICY,
  evaluatePlatformSession,
  isAbsoluteSessionExpired,
  latestTimestamp,
  parseStoredTimestamp,
  platformSessionActivityKey,
  platformSessionStartedKey,
  remainingMinutesLabel,
} from "./sessionPolicy.ts";

const MINUTE = 60_000;
const NOW = 1_800_000_000_000;

test("the platform session policy fixes 30 / 25 / 720 minutes", () => {
  assert.equal(PLATFORM_SESSION_POLICY.inactivityMs, 30 * MINUTE);
  assert.equal(PLATFORM_SESSION_POLICY.warningMs, 25 * MINUTE);
  assert.equal(PLATFORM_SESSION_POLICY.absoluteMs, 12 * 60 * MINUTE);
});

test("a fresh session within a short idle period is active", () => {
  const snapshot = evaluatePlatformSession({
    nowMs: NOW,
    lastActivityMs: NOW - 5 * MINUTE,
    sessionStartedMs: NOW - 60 * MINUTE,
  });
  assert.equal(snapshot.state, "active");
  assert.equal(snapshot.reason, undefined);
  assert.equal(snapshot.msUntilIdleExpiry, 25 * MINUTE);
  assert.equal(snapshot.msUntilWarning, 20 * MINUTE);
  assert.equal(snapshot.msUntilAbsoluteExpiry, 11 * 60 * MINUTE);
});

test("the warning starts at exactly 25 minutes of inactivity", () => {
  const justBefore = evaluatePlatformSession({
    nowMs: NOW,
    lastActivityMs: NOW - (25 * MINUTE - 1),
    sessionStartedMs: NOW,
  });
  assert.equal(justBefore.state, "active");

  const atWarning = evaluatePlatformSession({
    nowMs: NOW,
    lastActivityMs: NOW - 25 * MINUTE,
    sessionStartedMs: NOW,
  });
  assert.equal(atWarning.state, "warning");
  assert.equal(atWarning.reason, undefined);
  assert.equal(atWarning.msUntilIdleExpiry, 5 * MINUTE);
});

test("inactivity ends the session at exactly 30 minutes", () => {
  const justBefore = evaluatePlatformSession({
    nowMs: NOW,
    lastActivityMs: NOW - (30 * MINUTE - 1),
    sessionStartedMs: NOW,
  });
  assert.equal(justBefore.state, "warning");

  const expired = evaluatePlatformSession({
    nowMs: NOW,
    lastActivityMs: NOW - 30 * MINUTE,
    sessionStartedMs: NOW,
  });
  assert.equal(expired.state, "expired");
  assert.equal(expired.reason, "inactivity");
  assert.equal(expired.msUntilIdleExpiry, 0);
});

test("the 12-hour absolute cap wins even with recent activity", () => {
  const expired = evaluatePlatformSession({
    nowMs: NOW,
    lastActivityMs: NOW - 1_000,
    sessionStartedMs: NOW - 12 * 60 * MINUTE,
  });
  assert.equal(expired.state, "expired");
  assert.equal(expired.reason, "absolute");

  const active = evaluatePlatformSession({
    nowMs: NOW,
    lastActivityMs: NOW - 1_000,
    sessionStartedMs: NOW - (12 * 60 * MINUTE - 1),
  });
  assert.equal(active.state, "active");
  assert.equal(active.msUntilAbsoluteExpiry, 1);
});

test("an unknown sign-in time leaves the absolute cap unenforced but reported as null", () => {
  const snapshot = evaluatePlatformSession({
    nowMs: NOW,
    lastActivityMs: NOW,
    sessionStartedMs: null,
  });
  assert.equal(snapshot.state, "active");
  assert.equal(snapshot.msUntilAbsoluteExpiry, null);
});

test("a clock that moves backwards never reports negative remaining time", () => {
  const snapshot = evaluatePlatformSession({
    nowMs: NOW - 10 * MINUTE,
    lastActivityMs: NOW,
    sessionStartedMs: NOW,
  });
  assert.equal(snapshot.state, "active");
  assert.equal(snapshot.msUntilIdleExpiry, 30 * MINUTE);
  assert.equal(snapshot.msUntilAbsoluteExpiry, 12 * 60 * MINUTE);
});

test("the server-side absolute check never expires an unknown sign-in time", () => {
  assert.equal(isAbsoluteSessionExpired({ nowMs: NOW, sessionStartedMs: null }), false);
  assert.equal(
    isAbsoluteSessionExpired({ nowMs: NOW + 24 * 60 * MINUTE, sessionStartedMs: null }),
    false,
  );
});

test("the server-side absolute check expires at the 12-hour cap", () => {
  assert.equal(
    isAbsoluteSessionExpired({ nowMs: NOW, sessionStartedMs: NOW - (12 * 60 * MINUTE - 1) }),
    false,
  );
  assert.equal(
    isAbsoluteSessionExpired({ nowMs: NOW, sessionStartedMs: NOW - 12 * 60 * MINUTE }),
    true,
  );
});

test("session storage keys are isolated per session", () => {
  assert.equal(platformSessionActivityKey("sess_a"), "mylesnet:platform-session-activity:sess_a");
  assert.equal(platformSessionStartedKey("sess_a"), "mylesnet:platform-session-started:sess_a");
  assert.notEqual(platformSessionActivityKey("sess_a"), platformSessionActivityKey("sess_b"));
});

test("stored timestamps reject anything that is not a positive number", () => {
  assert.equal(parseStoredTimestamp(null), null);
  assert.equal(parseStoredTimestamp(""), null);
  assert.equal(parseStoredTimestamp("not-a-date"), null);
  assert.equal(parseStoredTimestamp("NaN"), null);
  assert.equal(parseStoredTimestamp("0"), null);
  assert.equal(parseStoredTimestamp("-5"), null);
  assert.equal(parseStoredTimestamp(String(NOW)), NOW);
});

test("the most recent usable activity wins across tabs", () => {
  assert.equal(latestTimestamp([NOW - 10, NOW - 1, null, undefined, NaN, 0]), NOW - 1);
  assert.equal(latestTimestamp([null, undefined]), null);
  assert.equal(latestTimestamp([]), null);
});

test("the remaining-minutes label never shows zero minutes", () => {
  assert.equal(remainingMinutesLabel(5 * MINUTE), 5);
  assert.equal(remainingMinutesLabel(MINUTE + 1), 2);
  assert.equal(remainingMinutesLabel(1), 1);
  assert.equal(remainingMinutesLabel(0), 1);
});
