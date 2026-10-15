import { defineConfig, devices } from '@playwright/test';

const isExternalBaseUrl = process.env.BASE_URL && !process.env.BASE_URL.includes('localhost') && !process.env.BASE_URL.includes('127.0.0.1');
const baseURL = process.env.BASE_URL || 'http://localhost:3000';

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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Automatically spin up the demo app if testing locally or against localhost
  ...(!isExternalBaseUrl ? {
    webServer: {
      command: 'node src/server.js',
      url: 'http://localhost:3000/',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    }
  } : {}),
});
