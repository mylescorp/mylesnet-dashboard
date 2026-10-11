import { pathToFileURL } from "node:url";

const POLL_INTERVAL_MS = 10_000;
const MAX_ATTEMPTS = 72;
const REQUIRED_CHECK_NAME = "Greptile Review";
const REQUIRED_APP_SLUG = "greptile-apps";

export function getGreptileCheckResult(checkRuns, headSha) {
  const matchingRuns = checkRuns
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

  const latestRun = matchingRuns[0];
  if (!latestRun || latestRun.status !== "completed") return "pending";
  return latestRun.conclusion === "success" ? "success" : "failure";
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
    const result = getGreptileCheckResult(runs, headSha);

    if (result === "success") {
      console.info("Greptile Review passed for the current pull request head at the required 5/5 threshold.");
      return;
    }

    if (result === "failure") {
      throw new Error("Greptile Review did not pass for the current pull request head.");
    }

    if (attempt < MAX_ATTEMPTS) await delay(POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for Greptile Review on the current pull request head.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
