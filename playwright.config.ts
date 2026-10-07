import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'line',
  use: { baseURL: 'http://127.0.0.1:4180', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' } }],
  webServer: { command: 'npx vite preview --host 127.0.0.1', url: 'http://127.0.0.1:4180', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
