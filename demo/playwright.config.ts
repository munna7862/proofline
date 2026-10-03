import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // the demo server keeps one cart in memory
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://localhost:4173' },
  reporter: [['list'], ['proofline/reporter']],
  webServer: {
    command: 'node shop/server.ts',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
