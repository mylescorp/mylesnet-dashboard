import assert from "node:assert/strict";
import { test } from "node:test";
import { getGreptileCheckResult } from "../.github/scripts/verify-greptile-five-of-five.mjs";

const headSha = "a".repeat(40);

function checkRun({
  conclusion = "success",
  head = headSha,
  name = "Greptile Review",
  slug = "greptile-apps",
  status = "completed",
} = {}) {
  return {
    app: { slug },
    conclusion,
    created_at: "2026-10-11T10:00:00Z",
    head_sha: head,
    name,
    started_at: "2026-10-11T10:00:00Z",
    status,
  };
}

test("accepts a successful Greptile review for the current head", () => {
  assert.equal(getGreptileCheckResult([checkRun()], headSha), "success");
});

test("does not accept a successful review from an earlier head", () => {
  assert.equal(getGreptileCheckResult([checkRun({ head: "b".repeat(40) })], headSha), "pending");
});

test("waits while the current head review is still running", () => {
  assert.equal(getGreptileCheckResult([checkRun({ status: "in_progress" })], headSha), "pending");
});

test("fails when the current head review does not pass", () => {
  assert.equal(getGreptileCheckResult([checkRun({ conclusion: "failure" })], headSha), "failure");
});

test("ignores similarly named checks from another app", () => {
  assert.equal(getGreptileCheckResult([checkRun({ slug: "other-app" })], headSha), "pending");
});

test("uses the newest Greptile run for the current head", () => {
  const failed = checkRun({ conclusion: "failure" });
  const passedLater = {
    ...checkRun(),
    created_at: "2026-10-11T11:00:00Z",
    started_at: "2026-10-11T11:00:00Z",
  };

  assert.equal(getGreptileCheckResult([failed, passedLater], headSha), "success");
});
