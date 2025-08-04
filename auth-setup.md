# LinkedIn Scraper Authentication Setup Guide

This guide explains how to set up authentication for the LinkedIn scraping tools and clarifies the different auth files used in the project.

## 📁 Auth Files Overview

The project uses multiple authentication files stored in `playwright/.auth/`:

| File | Purpose | Used By |
|------|---------|---------|
| `linkedin.json` | Primary auth file used by playwright config | Default for all scrapers via playwright.config.ts |
| `auth.json` | Alternative auth file | Can be used for specific scrapers |
| `my-auth.json` | Personal auth file | Used by post-scraping.spec.ts and manual login scripts |

## 🔐 Initial Authentication Setup

### Step 1: Run the Global Auth Setup

This creates the initial authentication state:

```bash
npx playwright test tests/auth/global.auth.setup.ts --project=auth
```

**What happens:**
- Opens a browser window
- Navigates to LinkedIn login page
- You manually log in with your credentials
- Saves the session to `playwright/.auth/linkedin.json`

### Step 2: Save Alternative Auth Files

After initial login, you can create alternative auth files:

```bash
npx playwright test tests/auth/save.auth.setup.ts --project=auth-save
```

**What happens:**
- Reads the existing `linkedin.json` auth state
- Creates copies as `auth.json` and `my-auth.json`
- All three files will contain the same authentication data

## 🔄 Manual Login (When Auth Expires)

If your authentication expires or you need to re-login:

```bash
npx tsx tests/auth/manual-login.ts
```

**What happens:**
- Opens a browser with LinkedIn
- You manually log in
- Saves the session to `my-auth.json`
- You can then run the save.auth.setup.ts to update other auth files

## 📝 Which Auth File to Use?

### Default Setup (linkedin.json)
Most scrapers use `linkedin.json` by default through playwright.config.ts:

```typescript
// playwright.config.ts
const AUTH_STATE = path.resolve(process.cwd(), 'playwright/.auth/linkedin.json');
```

### Custom Auth Files
Some scrapers may use different auth files:

```typescript
// Example: post-scraping.spec.ts uses my-auth.json
const AUTH_STATE = path.resolve(process.cwd(), 'playwright/.auth/my-auth.json');
```

## 🚀 Quick Start Guide

### First Time Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Run initial auth: `npx playwright test tests/auth/global.auth.setup.ts --project=auth`
4. Log in to LinkedIn when browser opens
5. Create alternative auth files: `npx playwright test tests/auth/save.auth.setup.ts --project=auth-save`

### Running Scrapers
Once authenticated, you can run any scraper:

```bash
# Connections scraper
npm run scrape:connections

# Search with pagination
npm run scrape:connections-via-pagination

# Posts scraper (uses my-auth.json)
npm run scrape:posts
```

## 🔧 Troubleshooting

### "Auth file not found" Error
If you see this error, check:
1. The auth file exists in `playwright/.auth/`
2. The scraper is looking for the correct auth file
3. Run the appropriate auth setup command

### "Auth wall detected" Error
Your session has expired. Re-authenticate:
1. Run: `npx tsx tests/auth/manual-login.ts`
2. Log in manually
3. Update other auth files if needed: `npx playwright test tests/auth/save.auth.setup.ts --project=auth-save`

### Different Scrapers Using Different Auth Files
This is intentional for flexibility:
- `linkedin.json` - Default for most scrapers
- `my-auth.json` - Used by posts scraper for personal scraping
- `auth.json` - Available as a backup or for custom scripts

## 📋 Auth File Structure

All auth files contain the same structure:
```json
{
  "cookies": [...],
  "origins": [
    {
      "origin": "https://www.linkedin.com",
      "localStorage": [...]
    }
  ]
}
```

## 🔒 Security Notes

1. **Never commit auth files** - They contain your session data
2. Add to `.gitignore`:
   ```
   playwright/.auth/*.json
   auth.json
   my-auth.json
   ```
3. Auth files expire after some time (LinkedIn security)
4. Each auth file contains your full LinkedIn session

## 📊 Auth Files Usage Summary

| Scraper | Auth File Used | Location |
|---------|----------------|----------|
| connections.spec.ts | linkedin.json | Via playwright.config.ts |
| search-filters-pagination.spec.ts | linkedin.json | Via playwright.config.ts |
| post-scraping.spec.ts | my-auth.json | Hardcoded in file |

## 🆘 Common Commands Reference

```bash
# Initial setup
npx playwright test tests/auth/global.auth.setup.ts --project=auth

# Save alternative auth files
npx playwright test tests/auth/save.auth.setup.ts --project=auth-save

# Manual re-login
npx tsx tests/auth/manual-login.ts

# Check if auth works
npx playwright test tests/auth/check-auth.spec.ts --project=scrape
```

## 💡 Best Practices

1. **Use the same auth file** across scrapers unless you have a specific reason
2. **Re-authenticate regularly** - LinkedIn sessions expire
3. **Keep auth files local** - Never share or commit them
4. **Update all auth files** after re-login to keep them in sync

---

**Note:** If you're unsure which auth file to use, stick with the default `linkedin.json` for consistency across all scrapers.
