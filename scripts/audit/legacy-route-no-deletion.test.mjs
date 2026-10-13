import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * No-deletion guard for the legacy panel and business-reporting surfaces.
 *
 * The matrix below mirrors
 * `docs/audits/legacy-route-no-deletion-audit-2026-10-13.md`. Each entry names a
 * shipped route facade and the implementation it loads. The guard fails when a
 * facade or its implementation disappears, or when the facade stops wiring to
 * the audited module, so a panel app-boundary change cannot silently drop a
 * legacy surface. It inspects active source only (comments are stripped), so a
 * commented-out re-export or redirect cannot satisfy it. Removing a surface
 * requires an owner-approved update to the audit and this matrix first.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const PANEL_ROOTS = [
  {
    route: "/admin",
    facade: "apps/web/app/(panels)/admin/page.tsx",
    implementation: "apps/web/admin/AdminEntryPage.tsx",
    specifier: "@/admin/AdminEntryPage",
  },
  {
    route: "/agency",
    facade: "apps/web/app/(panels)/agency/page.tsx",
    implementation: "apps/web/agency/AgencyEntryPage.tsx",
    specifier: "@/agency/AgencyEntryPage",
  },
  {
    route: "/reseller",
    facade: "apps/web/app/(panels)/reseller/page.tsx",
    implementation: "apps/web/reseller/ResellerEntryPage.tsx",
    specifier: "@/reseller/ResellerEntryPage",
  },
  {
    route: "/partner",
    facade: "apps/web/app/(panels)/partner/page.tsx",
    implementation: "apps/web/partner/PartnerEntryPage.tsx",
    specifier: "@/partner/PartnerEntryPage",
  },
];

const BUSINESS_ROUTES = [
  {
    route: "/insights/analytics",
    facade: "apps/web/app/(panels)/insights/analytics/page.tsx",
    implementation: "apps/web/dashboard/routes/insights/analytics/page.tsx",
    specifier: "@/dashboard/routes/insights/analytics/page",
  },
  {
    route: "/sales",
    facade: "apps/web/app/(panels)/sales/page.tsx",
    implementation: "apps/web/dashboard/routes/sales/page.tsx",
    specifier: "@/dashboard/routes/sales/page",
  },
  {
    route: "/revenue",
    facade: "apps/web/app/(panels)/revenue/page.tsx",
    implementation: "apps/web/dashboard/routes/revenue/page.tsx",
    specifier: "@/dashboard/routes/revenue/page",
  },
  {
    route: "/profit-loss",
    facade: "apps/web/app/(panels)/profit-loss/page.tsx",
    implementation: "apps/web/dashboard/routes/profit-loss/page.tsx",
    specifier: "@/dashboard/routes/profit-loss/page",
  },
  {
    route: "/profitability",
    facade: "apps/web/app/(panels)/profitability/page.tsx",
    implementation: "apps/web/dashboard/routes/profitability/page.tsx",
    specifier: "@/dashboard/routes/profitability/page",
  },
  {
    route: "/investor-reports",
    facade: "apps/web/app/(panels)/investor-reports/page.tsx",
    implementation: "apps/web/dashboard/routes/investor-reports/page.tsx",
    specifier: "@/dashboard/routes/investor-reports/page",
  },
  {
    route: "/scheduled-reports",
    facade: "apps/web/app/(panels)/scheduled-reports/page.tsx",
    implementation: "apps/web/dashboard/routes/scheduled-reports/page.tsx",
    specifier: "@/dashboard/routes/scheduled-reports/page",
  },
  {
    route: "/commissions",
    facade: "apps/web/app/(panels)/commissions/page.tsx",
    implementation: "apps/web/dashboard/routes/commissions/page.tsx",
    specifier: "@/dashboard/routes/commissions/page",
  },
  {
    route: "/finance/invoices",
    facade: "apps/web/app/(panels)/finance/invoices/page.tsx",
    implementation: "apps/web/dashboard/routes/finance/invoices/page.tsx",
    specifier: "@/dashboard/routes/finance/invoices/page",
  },
  {
    route: "/finance/payments",
    facade: "apps/web/app/(panels)/finance/payments/page.tsx",
    implementation: "apps/web/dashboard/routes/finance/payments/page.tsx",
    specifier: "@/dashboard/routes/finance/payments/page",
  },
];

const PROTECTED_ROUTES = [...PANEL_ROOTS, ...BUSINESS_ROUTES];

const ANALYTICS_ALIAS = {
  route: "/analytics",
  facade: "apps/web/app/(panels)/analytics/page.tsx",
  target: "/insights/analytics",
};

/** Remove block and line comments so inactive wiring cannot satisfy a check. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\{])\/\/[^\n]*/g, "$1");
}

/**
 * True when active source is exactly the canonical one-line default re-export
 * of `specifier` (comments and whitespace removed before comparison).
 */
export function isCanonicalReExport(source, specifier) {
  const active = stripComments(source).replace(/\s+/g, "");
  return active === `export{default}from"${specifier}";`;
}

/**
 * True when active source declares the default alias page whose body redirects
 * to `target` (comments removed, so a commented-out redirect does not count).
 */
export function hasActiveRedirect(source, target) {
  const active = stripComments(source).replace(/\s+/g, "");
  return new RegExp(
    `exportdefaultfunction\\w*\\(\\)\\{\\s*redirect\\("${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\);?\\}`,
  ).test(active);
}

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("every audited legacy facade still exists", () => {
  for (const { route, facade } of PROTECTED_ROUTES) {
    assert.ok(existsSync(path.join(repoRoot, facade)), `${route} facade is missing: ${facade}`);
  }
});

test("every audited legacy implementation module still exists", () => {
  for (const { route, implementation } of PROTECTED_ROUTES) {
    assert.ok(
      existsSync(path.join(repoRoot, implementation)),
      `${route} implementation is missing: ${implementation}`,
    );
  }
});

test("every audited legacy facade actively re-exports its audited implementation", () => {
  for (const { route, facade, specifier } of PROTECTED_ROUTES) {
    assert.ok(
      isCanonicalReExport(readRepoFile(facade), specifier),
      `${route} no longer actively re-exports ${specifier}`,
    );
  }
});

test("the /analytics compatibility alias actively redirects to /insights/analytics", () => {
  assert.ok(
    hasActiveRedirect(readRepoFile(ANALYTICS_ALIAS.facade), ANALYTICS_ALIAS.target),
    `${ANALYTICS_ALIAS.route} no longer actively redirects to ${ANALYTICS_ALIAS.target}`,
  );
});

test("commented-out wiring does not satisfy the guard", () => {
  assert.equal(isCanonicalReExport('// export { default } from "@/admin/AdminEntryPage";', "@/admin/AdminEntryPage"), false);
  assert.equal(
    isCanonicalReExport('/* export { default } from "@/admin/AdminEntryPage"; */', "@/admin/AdminEntryPage"),
    false,
  );
  assert.equal(isCanonicalReExport('export { default } from "@/other/Page";', "@/admin/AdminEntryPage"), false);
  assert.equal(hasActiveRedirect('// redirect("/insights/analytics");', "/insights/analytics"), false);
  assert.equal(
    hasActiveRedirect('export default function P() { /* redirect("/insights/analytics"); */ }', "/insights/analytics"),
    false,
  );
});
