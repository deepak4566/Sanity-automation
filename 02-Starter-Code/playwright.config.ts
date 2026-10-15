import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL;
if (!baseURL) {
  throw new Error('BASE_URL is not set. Set it as an env var locally, or as the BASE_URL variable on the GitHub Environment.');
}

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // one retry absorbs post-deploy warm-up flakiness
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'results/results.json' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true, // QA/dev often use internal certs; set to false if yours are valid
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
