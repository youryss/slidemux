import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: "./test-results/artifacts",
  reporter: [["list"], ["../../src/reporter.ts"]],
  workers: 1,
  timeout: 60_000,
});
