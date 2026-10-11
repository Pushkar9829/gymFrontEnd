import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against an isolated stack: API :5021 + web :5196 on database gym_mgmt_e2e.
// Uses the installed Microsoft Edge (no browser download). Run: npm run e2e
const E2E_DB = 'mongodb://127.0.0.1:27017/gym_mgmt_e2e';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: 'http://localhost:5196',
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1366, height: 820 } } }],
  webServer: [
    {
      command: 'node ../server/src/server.js',
      url: 'http://localhost:5021/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        DISABLE_RATE_LIMIT: '1',
        LOG_LEVEL: 'warn',
        PORT: '5021',
        MONGO_URI: E2E_DB,
        CLIENT_URLS: 'http://localhost:5196',
        JWT_ACCESS_SECRET: 'e2e-access-secret',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret',
      },
    },
    {
      command: 'npx vite --port 5196 --strictPort',
      url: 'http://localhost:5196',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_PROXY_TARGET: 'http://localhost:5021' },
    },
  ],
});

export { E2E_DB };
