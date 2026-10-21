import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser", timeout: 60000, expect: { timeout: 20000 }, use: { baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000", browserName: "chromium", ...(process.env.PLAYWRIGHT_CHROME_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } } : {}) },
  webServer: process.env.E2E_EXTERNAL ? undefined : { command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI, timeout: 120000 },
});
