import { pathToFileURL } from "node:url";

const POLL_INTERVAL_MS = 10_000;
const MAX_ATTEMPTS = 72;
const REQUIRED_CHECK_NAME = "Greptile Review";
const REQUIRED_APP_SLUG = "greptile-apps";
// Greptile completes its review check with a `success` conclusion even when it
// opens findings, and reports the findings in the review summary, for example
// "3 files reviewed, 2 comments added." A clean 5/5 review reports 0 comments.
// Parse that count so a below-5/5 review cannot pass the gate unnoticed.
const ADDED_COMMENT_PATTERN = /(\d+)\s+comments?\s+added/iu;

function greptileRunsForHead(checkRuns, headSha) {
  return checkRuns
    .filter(
      (run) =>
        run.name === REQUIRED_CHECK_NAME &&
        run.head_sha === headSha &&
        run.app?.slug === REQUIRED_APP_SLUG,
    )
    .sort(
      (left, right) =>
        Date.parse(right.started_at ?? right.created_at) -
        Date.parse(left.started_at ?? left.created_at),
    );
}

export function getGreptileCheckResult(checkRuns, headSha) {
  const latestRun = greptileRunsForHead(checkRuns, headSha)[0];
  if (!latestRun || latestRun.status !== "completed") return "pending";
  return latestRun.conclusion === "success" ? "success" : "failure";
}

export function getGreptileAddedCommentCount(checkRun) {
  // Greptile exposes the same summary through `summary` and `text`; read both so
  // a count present in only one of them is still found.
  for (const candidate of [checkRun?.output?.summary, checkRun?.output?.text]) {
    if (typeof candidate !== "string") continue;

    const match = candidate.match(ADDED_COMMENT_PATTERN);
    if (match) return Number.parseInt(match[1], 10);
  }

  return null;
}

/**
 * Resolves the gate state for the current head, including whether the review
 * was actually clean.
 *
 * - "pending"      the head's review has not completed yet
 * - "success"      the head's review completed successfully with 0 comments (5/5)
 * - "failure"      the review failed, or completed successfully but opened comments
 * - "unverifiable" the review summary did not report a comment count; fail closed
 */
export function getGreptileGateResult(checkRuns, headSha) {
  const checkResult = getGreptileCheckResult(checkRuns, headSha);
  if (checkResult !== "success") return checkResult;

  const latestRun = greptileRunsForHead(checkRuns, headSha)[0];
  const addedComments = getGreptileAddedCommentCount(latestRun);
  if (addedComments === null) return "unverifiable";

  return addedComments === 0 ? "success" : "failure";
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getCheckRuns(apiUrl, repository, headSha, token) {
  const endpoint = new URL(
    `/repos/${repository}/commits/${headSha}/check-runs?per_page=100`,
    apiUrl,
  );
  const response = await fetch(endpoint, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not read pull request checks (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  return payload.check_runs;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const apiUrl = process.env.GITHUB_API_URL;
  const headSha = process.env.PR_HEAD_SHA;

  if (!token || !repository || !apiUrl || !/^[a-f0-9]{40}$/i.test(headSha ?? "")) {
    throw new Error("The pull request check context is incomplete.");
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const runs = await getCheckRuns(apiUrl, repository, headSha, token);
    const result = getGreptileGateResult(runs, headSha);

    if (result === "success") {
      console.info("Greptile cleared the current pull request head at 5/5 (0 comments).");
      return;
    }

    if (result === "failure") {
      throw new Error(
        "Greptile did not clear the current pull request head at 5/5: the review either failed or opened comments. Fix every valid comment, reply on any invalid one, resolve the threads, and push a fix so Greptile re-reviews. Do not merge below 5/5.",
      );
    }

    if (result === "unverifiable") {
      throw new Error(
        "Greptile completed the review for the current pull request head but its summary did not report a comment count, so 5/5 cannot be confirmed. Failing closed: read the review on the pull request and merge only once it is a clean 5/5.",
      );
    }

    if (attempt < MAX_ATTEMPTS) await delay(POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for the current pull request head's Greptile review to complete.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
