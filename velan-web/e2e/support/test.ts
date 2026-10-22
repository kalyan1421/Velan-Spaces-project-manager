/**
 * The suite's `test`: Playwright's, plus a distinct client IP per test.
 *
 * The API rate-limits every route to 120 requests/min per client IP (and logins
 * to 8/min, enquiries to 5/min). A browser suite from one machine exceeds that,
 * so each test presents its own X-Forwarded-For — exactly what the production
 * reverse proxy does for distinct visitors. The web app forwards it to the API
 * unchanged; the API must run with TRUST_PROXY_HOPS=1 (the deployment default).
 */
import { test as base, type TestInfo } from "@playwright/test";
import { clientIpFor } from "./client-ip";

const ipForTest = (info: TestInfo) => clientIpFor(`${info.testId}:${info.repeatEachIndex}:${info.retry}`);

export const test = base.extend({
  // Applies to the page's browser context and to the `request` fixture alike.
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide, testInfo) => {
    await provide({ ...extraHTTPHeaders, "X-Forwarded-For": ipForTest(testInfo) });
  },
});

export { expect } from "@playwright/test";
