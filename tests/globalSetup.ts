import { execFileSync } from "node:child_process";

/**
 * Runs once before all test files. Builds dist/index.js so every test suite
 * that shells out to the CLI binary gets a fresh build — no more stale-dist
 * or MODULE_NOT_FOUND failures.
 */
export function setup() {
  execFileSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    encoding: "utf-8",
    timeout: 30000,
  });
}
