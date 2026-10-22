import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./e2e/support/env";

/**
 * RBAC + critical-flow e2e suite (spec R-G1 / R-G2). Runs against an already
 * running web app and API (it never builds or starts them), e.g. locally:
 *
 *   API:  cd velan-backend && set -a && . <api env> && set +a && PORT=3018 node dist/main.js
 *   Web:  API_URL=http://localhost:3018/api/v1 APP_URL=http://localhost:3101 npx next start -p 3101
 *   Run:  E2E_ENV_FILE=<api env> npm run test:e2e
 *
 * See e2e/support/env.ts for every setting. The data is shared, so tests run
 * serially in one worker; everything created is prefixed "E2E " and removed.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "./e2e/.output",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "./e2e/.report", open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
