import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const appRoot = join(process.cwd(), "app");
const allowedFiles = new Set(["shared/design/tokens.ts"]);
const sourceExtensions = new Set([".ts", ".tsx"]);
const rawColorPattern = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g;
const tailwindPalettePattern = /(?:^|[\s"'`])(?:bg|text|border|ring|outline|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-[\w/]+)?\b/g;
const globalsCssPath = join(process.cwd(), "app", "globals.css");
const externalVars = new Set(["--font-inter", "--font-jetbrains-mono", "--font-bricolage-grotesque", "--font-hanken-grotesk"]);
const landingCssPath = join(process.cwd(), "app", "(landing)", "landing.css");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf("."))) ? [path] : [];
  }));
  return files.flat();
}

const violations = [];
const report = (message) => violations.push(message);

// ---- 1. Application TypeScript: no literal colour values or Tailwind palette utilities ----
const moduleRoots = [
  "dashboard",
  "platform",
  "reseller",
  "agency",
  "partner",
  "captive-portal",
  "subscriber-portal",
  "landing",
  "shared",
  "admin",
];
const applicationRoots = [appRoot, ...moduleRoots.map((name) => join(process.cwd(), name))];
for (const root of applicationRoots) for (const file of await sourceFiles(root)) {
  const relativePath = relative(process.cwd(), file).replaceAll("\\", "/");
  if (allowedFiles.has(relativePath)) continue;
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(rawColorPattern)) {
    const line = source.slice(0, match.index).split("\n").length;
    report(`${relativePath}:${line} uses ${match[0]}`);
  }
  for (const match of source.matchAll(tailwindPalettePattern)) {
    const line = source.slice(0, match.index).split("\n").length;
    report(`${relativePath}:${line} uses raw Tailwind palette utility ${match[0].trim()}`);
  }
}

// ---- 2. globals.css: hex colours only inside the token-definition region ----
const css = await readFile(globalsCssPath, "utf8");

for (const token of [
  "--page-gutter",
  "--page-padding-block",
  "--card-radius",
  "--card-border",
  "--card-padding",
  "--card-padding-compact",
  "--card-gap",
  "--card-shadow",
  "--card-shadow-hover",
]) {
  if (!new RegExp(`${token}\\s*:`).test(css)) report(`globals.css is missing shared layout token ${token}`);
}
if (!/:root\s*\{[^}]*color-scheme:\s*light/s.test(css)) report("globals.css must set the light native color scheme");
if (!/:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/s.test(css)) report("globals.css must set the dark native color scheme");

const themeOpen = css.indexOf("@theme inline");
if (themeOpen === -1) throw new Error("globals.css lost its `@theme inline` block; token definition region cannot be located.");
const themeCloseBrace = css.indexOf("}", themeOpen);
if (themeCloseBrace === -1) throw new Error("globals.css `@theme inline` block never closes.");
const definitionEnd = themeCloseBrace + 1;
const ruleRegion = css.slice(definitionEnd);

const hexInRule = /#[0-9a-fA-F]{3,8}\b/g;
const inColorMix = (cssText, absoluteIndex) => {
  const lineStart = cssText.lastIndexOf("\n", absoluteIndex) + 1;
  const before = cssText.slice(Math.max(lineStart, absoluteIndex - 120), absoluteIndex);
  let depth = 0;
  for (let i = before.length - 1; i >= 0; i -= 1) {
    if (before[i] === ")") depth += 1;
    else if (before[i] === "(") { if (depth > 0) depth -= 1; else return before.slice(Math.max(0, i - 11), i).includes("color-mix"); }
  }
  return false;
};
for (const match of ruleRegion.matchAll(hexInRule)) {
  const absoluteIndex = definitionEnd + match.index;
  const line = css.slice(0, absoluteIndex).split("\n").length;
  if (inColorMix(css, absoluteIndex)) continue;
  report(`globals.css:${line} uses ${match[0]} outside the token-definition region`);
}

// ---- 3. globals.css: no references to undefined custom properties ----
const definedNames = new Set();
for (const name of css.matchAll(/--[\w-]+/g)) definedNames.add(name[0]);
const varPattern = /var\(\s*(--[\w-]+)/g;
for (const match of css.matchAll(varPattern)) {
  const name = match[1];
  if (definedNames.has(name) || externalVars.has(name)) continue;
  const line = css.slice(0, match.index).split("\n").length;
  report(`globals.css:${line} references var(${name}) which is never defined`);
}

// ---- 3b. Landing CSS: raw colour values only inside `:root` token blocks ----
async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return path.endsWith(".css") ? [path] : [];
  }));
  return files.flat();
}

const rootTokenBlocks = (cssText) => {
  const blocks = [];
  const re = /:root\s*\{/g;
  let match;
  while ((match = re.exec(cssText))) {
    let depth = 0;
    let i = match.index;
    for (; i < cssText.length; i += 1) {
      if (cssText[i] === "{") depth += 1;
      else if (cssText[i] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    blocks.push([match.index, i + 1]);
  }
  return blocks;
};

const colorOutsideTokenBlock = (cssText) => {
  const blocks = rootTokenBlocks(cssText);
  const rawInRule = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g;
  const hits = [];
  for (const match of cssText.matchAll(rawInRule)) {
    const abs = match.index;
    if (blocks.some(([start, end]) => abs >= start && abs < end)) continue;
    hits.push(match);
  }
  return hits;
};

const landingCssRoot = join(process.cwd(), "app", "(public)");
for (const file of await cssFiles(landingCssRoot)) {
  const relativePath = relative(process.cwd(), file).replaceAll("\\", "/");
  const landingCss = await readFile(file, "utf8");
  if (relativePath.endsWith("landing.css")) {
    const landingRoot = rootTokenBlocks(landingCss).map(([start, end]) => landingCss.slice(start, end)).join("\n");
    for (const token of ["--landing-container", "--landing-radius", "--landing-radius-lg", "--landing-glass", "--landing-glass-border", "--landing-ink-start", "--landing-ink-end"]) {
      if (new RegExp(`${token}\\s*:`).test(landingRoot)) report(`${relativePath} must inherit shared token ${token} from globals.css`);
    }
  }
  for (const match of colorOutsideTokenBlock(landingCss)) {
    const line = landingCss.slice(0, match.index).split("\n").length;
    report(`${relativePath}:${line} uses ${match[0]} outside a :root token block`);
  }
}

// ---- Result ----
if (violations.length > 0) {
  console.error("Design token violations:");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exitCode = 1;
} else {
  console.log(
    "Design token check passed: no raw colour values or Tailwind palette utilities in application TypeScript, no undefined custom properties in globals.css, and no raw colour values outside :root token blocks in app/(public)/ CSS."
  );
}

// ---- 4. Landing.css demolition manifest (REPORT-ONLY) ----
const landingCssClasses = [
  // Phase 3: Slated for migration
  "landing-card",
  "landing-plan-card",
  "landing-audience-pill",
  "landing-plan-badge",
  "landing-section-kicker",
  "landing-nav-link",
  "landing-prose",
  "landing-preview-wrap",
  "landing-preview",
  "landing-preview-body",
  "landing-legend",
  "landing-roadmap",
  "landing-how-steps",
];

console.log("\n=== Landing.css demolition manifest (REPORT-ONLY) ===");
console.log("Phase 2 (MIGRATED/DELETED):");
console.log("  - .landing-status-chip → shadcn Badge");
console.log("  - .landing-pricing-switch → shadcn Select");
console.log("  - .landing-nav-toggle → shadcn Sheet trigger");
console.log("  - .landing-mobile-menu → shadcn Sheet content");
console.log("\nPhase 3 Batch 1 (MIGRATED/DELETED):");
console.log("  - .landing-text-link → shadcn Button (link variant)");
console.log("  - .landing-secondary-button → shadcn Button (outline variant)");
console.log("  - .landing-faq → shadcn Accordion");
console.log("\nPhase 3 Batch 2 (MIGRATED/DELETED):");
console.log("  - .landing-bento-card, .landing-solution-card, .landing-trust-card,");
console.log("    .landing-process-step, .landing-resource-card, .landing-stat-card,");
console.log("    .landing-checklist-item, .landing-int-row, .landing-lifecycle-step,");
console.log("    .landing-problem-item, .landing-attribute-chip, .landing-int-tiles,");
console.log("    .landing-hero*, .landing-compare* → LandingCard (apps/web/landing/components/LandingCard.tsx)");
console.log("\nPhase 3 Batch 3 (MIGRATED/DELETED):");
console.log("  - .landing-cta-band, .landing-cta-inner, .landing-home-cta,");
console.log("    .landing-cta-button, .landing-secondary-button, .landing-hero-actions*");
console.log("    → LandingCtaSection (apps/web/landing/components/LandingCtaSection.tsx)");
console.log("    Closing CTA is now one card per next step; the dark full-width band is gone.");
console.log("\nPhase 3 Batch 4 (MIGRATED/DELETED):");
console.log("  - .landing-page-banner band chrome (.landing-page-banner h1,");
console.log("    .landing-banner-lead, .landing-banner-meta*) → LandingCard variant=\"hero\"");
console.log("    on all 18 route banners; the band is now a thin wrapper around the card.");
console.log("  - .landing-home-hero::before/::after, .landing-home-hero-inner/copy,");
console.log("    .landing-home-eyebrow, .landing-home-title, .landing-home-lead");
console.log("    → LandingCard variant=\"hero\" (className .landing-home-hero-card),");
console.log("    with the photo crossfade clipped inside the card.");
console.log("  - Footer markup → .landing-footer-card: one card holds masthead, sitemap,");
console.log("\nPhase 3 (SLATED for migration):");
for (const className of landingCssClasses) {
  console.log(`  - .${className}`);
}
console.log("=== End demolition manifest ===\n");
