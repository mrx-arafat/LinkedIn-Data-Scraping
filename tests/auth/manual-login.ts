import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const OUTPUT_PATH = path.resolve(process.cwd(), 'playwright/.auth/my-auth.json');

(async () => {
  console.log('🔐 LinkedIn Manual Login Helper');
  console.log('================================');
  console.log('This will open a browser for you to log in to LinkedIn.');
  console.log('Once logged in, the session will be saved for reuse.\n');

  // Launch browser with UI
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  console.log('📍 Navigating to LinkedIn...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });

  console.log('\n✋ MANUAL STEPS:');
  console.log('1. Enter your email/username and password');
  console.log('2. Click "Sign in"');
  console.log('3. Complete any 2FA/verification if prompted');
  console.log('4. Wait until you see your LinkedIn feed/home page');
  console.log('5. Press Enter in this terminal when done\n');

  // Wait for user to complete login
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });

  // Check if logged in by looking for feed or profile elements
  const isLoggedIn = await page.locator('nav[aria-label="Primary Navigation"]').isVisible().catch(() => false) ||
                     await page.locator('[data-test-id="home-feed"]').isVisible().catch(() => false) ||
                     await page.locator('.feed-identity-module').isVisible().catch(() => false);

  if (!isLoggedIn) {
    console.log('⚠️  Warning: Could not detect LinkedIn login. Saving state anyway...');
  } else {
    console.log('✅ Login detected!');
  }

  // Save storage state
  console.log(`\n💾 Saving authentication to: ${OUTPUT_PATH}`);
  await context.storageState({ path: OUTPUT_PATH });

  console.log('\n🎉 Done! Your session is saved.');
  console.log('\nThe scraper will automatically use: playwright/.auth/my-auth.json');

  await browser.close();
  process.exit(0);
})().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
