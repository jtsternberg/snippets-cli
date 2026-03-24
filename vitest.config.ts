import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    disableConsoleIntercept: true,
    globalSetup: "./tests/globalSetup.ts",
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
