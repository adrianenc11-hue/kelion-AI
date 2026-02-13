// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Sequential for headed visibility
  timeout: 60000, // per-test timeout (60s)
  globalTimeout: 300000, // entire suite max 5min — kills everything if exceeded
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'https://kelionai.app',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
    navigationTimeout: 30000, // max 30s per page.goto
    actionTimeout: 15000, // max 15s per click/fill/etc
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
