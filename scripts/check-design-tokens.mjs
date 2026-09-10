import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const appRoot = join(process.cwd(), "app");
const allowedFiles = new Set(["app/design/tokens.ts"]);
const sourceExtensions = new Set([".ts", ".tsx"]);
const rawColorPattern = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g;
const globalsCssPath = join(process.cwd(), "app", "globals.css");
const externalVars = new Set(["--font-geist-sans", "--font-geist-mono"]);

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

// ---- 1. Application TypeScript: no literal colour values ----
for (const file of await sourceFiles(appRoot)) {
  const relativePath = relative(process.cwd(), file).replaceAll("\\", "/");
  if (allowedFiles.has(relativePath)) continue;
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(rawColorPattern)) {
    const line = source.slice(0, match.index).split("\n").length;
    report(`${relativePath}:${line} uses ${match[0]}`);
  }
}

// ---- 2. globals.css: hex colours only inside the token-definition region ----
const css = await readFile(globalsCssPath, "utf8");

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

// ---- Result ----
if (violations.length > 0) {
  console.error("Design token violations:");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exitCode = 1;
} else {
  console.log(
    "Design token check passed: no raw colour values in application TypeScript or rule CSS, and no undefined custom properties in globals.css."
  );
}