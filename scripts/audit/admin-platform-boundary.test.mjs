import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
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

async function walkFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(full)));
    else files.push(relative(directory, full));
  }
  return files.map(toPosix).sort();
}

test("apps/admin mirrors the shipped platform route tree", async () => {
  const web = await walkFiles(join(webRoot, panelRoutes));
  const admin = await walkFiles(join(adminRoot, panelRoutes));

  assert.ok(web.length >= 24, `expected the full platform route tree, found ${web.length} files`);
  assert.ok(web.includes("page.tsx"), "platform route tree must include the panel root page");
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

test("apps/admin auth routes, layouts and proxy mirror apps/web", async () => {
  for (const file of mirroredFiles) {
    const [web, admin] = await Promise.all([
      readFile(join(webRoot, file), "utf8"),
      readFile(join(adminRoot, file), "utf8"),
    ]);
    assert.equal(admin, web, `${file} differs between apps/web and apps/admin`);
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
  const css = await readFile(join(adminRoot, "app/globals.css"), "utf8");

  assert.match(
    css,
    /@import\s+"\.\.\/\.\.\/web\/app\/globals\.css"/,
    "globals.css must reuse the web token and shell stylesheet",
  );
  for (const source of ["../../web/platform", "../../web/shared", "../../packages/ui/src"]) {
    assert.ok(css.includes(`@source "${source}"`), `globals.css must declare @source "${source}"`);
  }
});
