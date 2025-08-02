import { defineConfig } from '@playwright/test';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const AUTH_STATE = path.resolve(process.cwd(), 'playwright/.auth/linkedin.json');

export default defineConfig({
  testDir: './tests',
  timeout: 600_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list']],
  workers: 1,

  use: {
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    headless: false,
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    baseURL: 'https://www.linkedin.com',
  },

  projects: [
    {
      name: 'auth',
      testMatch: /.*\.auth\.setup\.ts/,
    },
    {
      name: 'auth-save',
      testMatch: /.*save\.auth\.setup\.ts/,
      use: { storageState: AUTH_STATE },
      dependencies: ['auth'],
    },
    {
      name: 'scrape',
      use: { storageState: AUTH_STATE },
      dependencies: ['auth', 'auth-save'],
      testMatch: /.*\.(spec|test)\.ts/,
    },
  ],
});

