import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.ISLO_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || '/workspace/islo-qa/.auth/user.json',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-http2'],
        },
      },
      dependencies: ['setup'],
    },
  ],
});
