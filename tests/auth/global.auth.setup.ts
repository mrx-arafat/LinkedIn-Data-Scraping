import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AUTH_FILE = path.resolve(process.cwd(), "playwright/.auth/linkedin.json");
const ALT_AUTH_FILE = path.resolve(process.cwd(), "playwright/.auth/auth.json");

function isValidStorageFile(p: string): boolean {
  try {
    if (!fs.existsSync(p)) return false;
    const obj = JSON.parse(fs.readFileSync(p, "utf-8")) as {
      cookies?: any[];
      origins?: any[];
    };
    return !!obj && Array.isArray(obj.cookies) && obj.cookies.length > 0;
  } catch {
    return false;
  }
}

// Skip only if we already have valid cookies saved
if (isValidStorageFile(AUTH_FILE) || isValidStorageFile(ALT_AUTH_FILE)) {
  setup.skip(true, "Valid auth state exists, skipping login");
}

setup(
  "authenticate to LinkedIn and save storage",
  async ({ page }, testInfo) => {
    const email = process.env.LI_EMAIL;
    const password = process.env.LI_PASSWORD;
    if (!email || !password) {
      throw new Error("LI_EMAIL and LI_PASSWORD must be set in .env");
    }

    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // Start from home, then click Sign in for stability
    await page.goto("https://www.linkedin.com/", {
      waitUntil: "domcontentloaded",
    });
    const signInLink = page.getByRole("link", { name: "Sign in", exact: true });
    if (await signInLink.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded"),
        signInLink.click(),
      ]);
    } else {
      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
      });
    }

    // Fill login form using accessible roles (matches your working snippet)
    await page.getByRole("textbox", { name: "Email or phone" }).fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Sign in", exact: true }).click(),
    ]);

    // Wait until we get the li_at cookie or user completes checkpoint
    const started = Date.now();
    let hasLiAt = false;
    while (Date.now() - started < 90_000) {
      const cookies = await page
        .context()
        .cookies(["https://www.linkedin.com"]);
      if (cookies.some((c) => c.name === "li_at")) {
        hasLiAt = true;
        break;
      }
      await page.waitForTimeout(2000);
    }

    if (!hasLiAt) {
      testInfo.annotations.push({
        type: "info",
        description:
          "Manual login likely required. Complete any checkpoints, then resume.",
      });
      await page.pause(); // allow user to complete login / 2FA
    }

    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForLoadState("networkidle", { timeout: 45_000 })
      .catch(() => {});

    // Verify by presence of cookie
    const finalCookies = await page
      .context()
      .cookies(["https://www.linkedin.com"]);
    if (!finalCookies.some((c) => c.name === "li_at")) {
      throw new Error("Login did not succeed. Storage would be empty.");
    }

    // Save to both files for convenience
    const dir = path.dirname(AUTH_FILE);
    fs.mkdirSync(dir, { recursive: true });
    await page.context().storageState({ path: AUTH_FILE });
    await page.context().storageState({ path: ALT_AUTH_FILE });
  }
);
