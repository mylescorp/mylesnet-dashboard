import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getGreptileAddedCommentCount,
  getGreptileCheckResult,
  getGreptileGateResult,
} from "../.github/scripts/verify-greptile-five-of-five.mjs";

const headSha = "a".repeat(40);

function checkRun({
  conclusion = "success",
  head = headSha,
  name = "Greptile Review",
  slug = "greptile-apps",
  status = "completed",
  summary = "3 files reviewed, 0 comments added.",
} = {}) {
  return {
    app: { slug },
    conclusion,
    created_at: "2026-10-11T10:00:00Z",
    head_sha: head,
    name,
    output: summary === null ? undefined : { summary, title: "Base review" },
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

test("parses the comment count from the review summary", () => {
  assert.equal(getGreptileAddedCommentCount(checkRun({ summary: "3 files reviewed, 2 comments added." })), 2);
  assert.equal(getGreptileAddedCommentCount(checkRun({ summary: "3 files reviewed, 1 comment added." })), 1);
  assert.equal(getGreptileAddedCommentCount(checkRun({ summary: "3 files reviewed, 0 comments added." })), 0);
});

test("reports an unknown comment count when the summary omits it", () => {
  assert.equal(getGreptileAddedCommentCount(checkRun({ summary: "Greptile has reviewed the Pull Request." })), null);
  assert.equal(getGreptileAddedCommentCount(checkRun({ summary: null })), null);
});

test("gate passes a clean 5/5 review", () => {
  assert.equal(getGreptileGateResult([checkRun()], headSha), "success");
});

test("gate fails a successful review that opened comments", () => {
  const run = checkRun({ summary: "2 files reviewed, 2 comments added." });
  assert.equal(getGreptileCheckResult([run], headSha), "success");
  assert.equal(getGreptileGateResult([run], headSha), "failure");
});

test("gate fails closed when the review summary omits the comment count", () => {
  const run = checkRun({ summary: "Greptile has reviewed the Pull Request." });
  assert.equal(getGreptileGateResult([run], headSha), "unverifiable");
});

test("gate stays pending until the current head review completes", () => {
  assert.equal(getGreptileGateResult([checkRun({ status: "in_progress" })], headSha), "pending");
  assert.equal(getGreptileGateResult([checkRun({ head: "b".repeat(40) })], headSha), "pending");
});

test("gate applies the comment count to the newest review for the head", () => {
  const unclean = checkRun({ summary: "2 files reviewed, 2 comments added." });
  const cleanLater = {
    ...checkRun(),
    created_at: "2026-10-11T11:00:00Z",
    started_at: "2026-10-11T11:00:00Z",
  };

  assert.equal(getGreptileGateResult([unclean, cleanLater], headSha), "success");
});
