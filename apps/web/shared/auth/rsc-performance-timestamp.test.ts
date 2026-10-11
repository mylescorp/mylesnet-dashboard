import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const clientBundles = [
  "react-server-dom-turbopack/cjs/react-server-dom-turbopack-client.browser.development.js",
  "react-server-dom-turbopack-experimental/cjs/react-server-dom-turbopack-client.browser.development.js",
  "react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js",
  "react-server-dom-webpack-experimental/cjs/react-server-dom-webpack-client.browser.development.js",
];

test("aborted and errored Server Components skip invalid performance timestamps", async () => {
  for (const bundle of clientBundles) {
    const source = await readFile(
      new URL(`../../node_modules/next/dist/compiled/${bundle}`, import.meta.url),
      "utf8",
    );

    assert.match(source, /error = root\.reason;\s+if \(supportsUserTiming && 0 <= childrenEndTime\$jscomp\$1\)/, bundle);
    assert.match(source, /childrenEndTime\$jscomp\$3 = childrenEndTime;\s+if \(supportsUserTiming && 0 <= childrenEndTime\$jscomp\$3\)/, bundle);
  }
});
