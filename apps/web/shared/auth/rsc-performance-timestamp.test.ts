import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const clientBundles = [
  "react-server-dom-turbopack/cjs/react-server-dom-turbopack-client.browser.development.js",
  "react-server-dom-turbopack-experimental/cjs/react-server-dom-turbopack-client.browser.development.js",
  "react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js",
  "react-server-dom-webpack-experimental/cjs/react-server-dom-webpack-client.browser.development.js",
];

const functionParameters = [
  "supportsUserTiming",
  "childEndTime",
  "startTime",
  "componentInfo",
  "trackIdx",
  "error",
  "response",
  "trackNames",
  "performance",
  "addValueToProperties",
  "addObjectToProperties",
  "_env",
];

function extractGuardedBlock(source: string, start: number): string {
  const openBrace = source.indexOf("{", start);
  assert.notEqual(openBrace, -1, "guard block must have an opening brace");

  let depth = 0;
  for (let index = openBrace; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}" && --depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  assert.fail("guard block must have a closing brace");
}

test("errored and aborted Server Components measure only valid end timestamps", async () => {
  for (const bundle of clientBundles) {
    const source = await readFile(
      new URL(`../../node_modules/next/dist/compiled/${bundle}`, import.meta.url),
      "utf8",
    );
    const guards = [...source.matchAll(
      /if \(supportsUserTiming && 0 <= (childrenEndTime\$jscomp\$(?:1|3))\) \{/g,
    )];

    assert.equal(guards.length, 2, `${bundle}: expected errored and aborted timing guards`);
    assert.deepEqual(
      guards.map((guard) => guard[1]).sort(),
      ["childrenEndTime$jscomp$1", "childrenEndTime$jscomp$3"],
      `${bundle}: expected both guarded end-time variables`,
    );

    for (const guard of guards) {
      const block = extractGuardedBlock(source, guard.index!).replaceAll(
        /(?:childrenEndTime|startTime|componentInfo|trackIdx)\$jscomp\$\d+/g,
        (identifier) =>
          identifier.startsWith("childrenEndTime") ? "childEndTime" : identifier.split("$")[0]!,
      );
      const runGuardedBlock = new Function(...functionParameters, block) as (
        ...args: unknown[]
      ) => void;

      for (const childEndTime of [-1, 0, 1]) {
        let measurements = 0;
        const performance = {
          measure: () => measurements++,
          clearMeasures: () => undefined,
        };

        runGuardedBlock(
          true,
          childEndTime,
          0,
          { env: undefined, name: "TenantDashboardLayout", key: null, props: null },
          0,
          new Error("render failed"),
          { _rootEnvironmentName: undefined },
          ["Server Components"],
          performance,
          () => undefined,
          () => undefined,
          undefined,
        );

        assert.equal(
          measurements,
          childEndTime < 0 ? 0 : 1,
          `${bundle}: unexpected performance.measure count for end time ${childEndTime}`,
        );
      }

      let measurements = 0;
      runGuardedBlock(
        false,
        1,
        0,
        { env: undefined, name: "TenantDashboardLayout", key: null, props: null },
        0,
        new Error("render failed"),
        { _rootEnvironmentName: undefined },
        ["Server Components"],
        { measure: () => measurements++, clearMeasures: () => undefined },
        () => undefined,
        () => undefined,
        undefined,
      );
      assert.equal(measurements, 0, `${bundle}: unsupported user timing must not measure`);
    }
  }
});
