import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const AUTH_FILE = path.resolve(process.cwd(), 'playwright/.auth/auth.json');

setup('save current storage state to alt auth.json', async ({ page }) => {
  // Only run if not present or empty
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      if (Array.isArray(parsed?.cookies) && parsed.cookies.length > 0) return;
    } catch {}
  }

  const dir = path.dirname(AUTH_FILE);
  fs.mkdirSync(dir, { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});

