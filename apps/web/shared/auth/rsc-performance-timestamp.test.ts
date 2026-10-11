import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const clientBundles = [
  "react-server-dom-turbopack/cjs/react-server-dom-turbopack-client.browser.development.js",
  "react-server-dom-turbopack-experimental/cjs/react-server-dom-turbopack-client.browser.development.js",
  "react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js",
  "react-server-dom-webpack-experimental/cjs/react-server-dom-webpack-client.browser.development.js",
];

const guards = [
  /if \((supportsUserTiming && 0 <= childrenEndTime\$jscomp\$1)\) \{/g,
  /if \((supportsUserTiming && 0 <= childrenEndTime\$jscomp\$3)\) \{/g,
];

test("aborted and errored Server Components skip invalid performance timestamps", async () => {
  for (const bundle of clientBundles) {
    const source = await readFile(
      new URL(`../../node_modules/next/dist/compiled/${bundle}`, import.meta.url),
      "utf8",
    );

    for (const guardPattern of guards) {
      const matches = [...source.matchAll(guardPattern)];
      assert.equal(matches.length, 1, `${bundle}: expected one patched guard`);

      const expression = matches[0][1].replace(
        /childrenEndTime\$jscomp\$[13]/,
        "childEndTime",
      );
      const shouldMeasure = new Function(
        "supportsUserTiming",
        "childEndTime",
        "measure",
        `if (${expression}) measure();`,
      ) as (supportsUserTiming: boolean, childEndTime: number, measure: () => void) => void;

      for (const childEndTime of [-1, 0, 1]) {
        let measurements = 0;
        shouldMeasure(true, childEndTime, () => measurements++);
        assert.equal(
          measurements,
          childEndTime < 0 ? 0 : 1,
          `${bundle}: unexpected measurement count for child end time ${childEndTime}`,
        );
      }

      let measurements = 0;
      shouldMeasure(false, 1, () => measurements++);
      assert.equal(measurements, 0, `${bundle}: measurement must require user timing support`);
    }
  }
});
