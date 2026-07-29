import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  workers: 1, // Electron 应用串行执行
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure"
  }
});
