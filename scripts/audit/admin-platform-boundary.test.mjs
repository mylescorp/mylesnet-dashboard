import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * apps/admin platform-boundary contract.
 *
 * `apps/admin` is a separately deployable app that currently ships the same
 * `/platform` surface as `apps/web`. That overlap is deliberately guarded here:
 * both route trees must match and the panel/auth source must not silently
 * diverge while both deployments are live. When `apps/admin` takes ownership of
 * the panel source, this contract is updated together with the
 * docs/architecture/repository-map.md migration note.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const webRoot = join(repoRoot, "apps/web");
const adminRoot = join(repoRoot, "apps/admin");
const panelRoutes = "app/(panels)/platform";

/** Tailwind `@source` directives in globals.css, relative to that file. */
const tailwindSources = [
  "../../web/platform",
  "../../web/shared",
  "../../../packages/ui/src",
];

const mirroredFiles = [
  "app/(panels)/auth/callback/route.ts",
  "app/(panels)/signin/route.ts",
  "app/(panels)/sign-out/route.ts",
  "app/(panels)/login/route.ts",
  "app/(panels)/password-reset/route.ts",
  "app/(panels)/invite/route.ts",
  "app/(panels)/no-access/page.tsx",
  "app/layout.tsx",
  "app/(panels)/layout.tsx",
  "app/error.tsx",
  "app/global-error.tsx",
  "proxy.ts",
  "public/theme-init.js",
  "public/brand/mylesnet-logo.png",
];

const toPosix = (path) => path.split(sep).join("/");

/**
 * File paths under `directory`, relative to `directory`, sorted. Recursion
 * carries the original `base` so nested files keep their parent directories
 * (two nested `page.tsx` files must not collapse into one entry).
 */
export async function walkFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(full, base)));
    else files.push(toPosix(relative(base, full)));
  }
  return files.sort();
}

test("walkFiles preserves nested route paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "admin-boundary-"));
  try {
    await mkdir(join(directory, "organizations/[id]/markets"), { recursive: true });
    await writeFile(join(directory, "page.tsx"), "");
    await writeFile(join(directory, "organizations/[id]/markets/page.tsx"), "");

    assert.deepEqual(await walkFiles(directory), [
      "organizations/[id]/markets/page.tsx",
      "page.tsx",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("apps/admin mirrors the shipped platform route tree", async () => {
  const web = await walkFiles(join(webRoot, panelRoutes));
  const admin = await walkFiles(join(adminRoot, panelRoutes));

  assert.ok(web.length >= 24, `expected the full platform route tree, found ${web.length} files`);
  assert.equal(new Set(web).size, web.length, "route paths must stay unique");
  assert.ok(
    web.includes("organizations/[id]/markets/page.tsx"),
    "nested platform routes must keep their full path",
  );
  assert.deepEqual(admin, web, "apps/admin must serve exactly the platform routes apps/web serves");
});

test("apps/admin platform routes cannot silently diverge from apps/web", async () => {
  for (const file of await walkFiles(join(webRoot, panelRoutes))) {
    const [web, admin] = await Promise.all([
      readFile(join(webRoot, panelRoutes, file), "utf8"),
      readFile(join(adminRoot, panelRoutes, file), "utf8"),
    ]);
    assert.equal(admin, web, `${panelRoutes}/${file} differs between apps/web and apps/admin`);
  }
});

test("apps/admin auth routes, layouts, proxy and assets mirror apps/web", async () => {
  for (const file of mirroredFiles) {
    const [web, admin] = await Promise.all([
      readFile(join(webRoot, file)),
      readFile(join(adminRoot, file)),
    ]);
    assert.ok(admin.equals(web), `${file} differs between apps/web and apps/admin`);
  }
});

test("apps/admin app shell and runtime assets exist", async () => {
  const required = [
    "package.json",
    "next.config.ts",
    "tsconfig.json",
    "vercel.json",
    "app/globals.css",
    "app/favicon.ico",
    "app/layout.tsx",
    "app/(panels)/layout.tsx",
    "proxy.ts",
    "public/theme-init.js",
    "public/brand/mylesnet-logo.png",
  ];
  for (const file of required) {
    await assert.doesNotReject(stat(join(adminRoot, file)), `apps/admin/${file} is required`);
  }
});

test("apps/admin payment credential routes delegate to same-origin handlers", async () => {
  const csrf = await readFile(join(adminRoot, "app/api/auth/csrf/route.ts"), "utf8");
  const credentials = await readFile(
    join(adminRoot, "app/api/platform/payment-gateways/[configId]/credentials/route.ts"),
    "utf8",
  );

  assert.match(csrf, /export\s*\{\s*GET\s*\}\s*from\s*["']@\/app\/api\/auth\/csrf\/route["']/);
  assert.match(
    credentials,
    /export\s*\{\s*POST\s*\}\s*from\s*["']@\/app\/api\/platform\/payment-gateways\/\[configId\]\/credentials\/route["']/,
  );
  assert.match(credentials, /export\s+const\s+runtime\s*=\s*["']nodejs["']/);
});

test("apps/admin reuses shared sources instead of copying them", async () => {
  const tsconfig = JSON.parse(await readFile(join(adminRoot, "tsconfig.json"), "utf8"));
  const aliases = tsconfig.compilerOptions.paths;

  assert.equal(aliases["@/*"][0], "../web/*", "admin must alias @/* into the shared web source");
  assert.equal(aliases["@/lib/*"][0], "../web/shared/*", "admin must alias @/lib into shared web source");
  assert.equal(aliases["@/convex/*"][0], "../../convex/*", "admin must alias @/convex to the shared backend");

  const panel = await readFile(join(webRoot, "platform/PlatformOverviewPage.tsx"), "utf8");
  assert.ok(panel.includes('requirePanelAccess("platform")'), "the shared panel entry keeps its server gate");
});

test("apps/admin declares the Tailwind sources it reuses", async () => {
  const globalsCss = join(adminRoot, "app/globals.css");
  const css = await readFile(globalsCss, "utf8");

  assert.match(
    css,
    /@import\s+"\.\.\/\.\.\/web\/app\/globals\.css"/,
    "globals.css must reuse the web token and shell stylesheet",
  );
  for (const source of tailwindSources) {
    assert.ok(css.includes(`@source "${source}"`), `globals.css must declare @source "${source}"`);
    // The directive is resolved relative to globals.css, so a wrong relative
    // depth silently scans nothing instead of failing the build.
    await assert.doesNotReject(
      stat(join(adminRoot, "app", source)),
      `@source "${source}" must resolve to a real directory`,
    );
  }
});
