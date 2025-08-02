## LinkedIn Playwright Scraper

A Playwright + TypeScript project that logs into LinkedIn once and reuses session state for scraping. Includes a connections scraper with infinite scroll and export to JSON/CSV.

### 1. Install dependencies

npm install
npx playwright install chromium

### 2. Configure credentials

Copy .env.example to .env and set LI_EMAIL and LI_PASSWORD.

Alternatively, defaults are hardcoded for quick start.

### 3. Run authentication and scrape

# Full test run (auth + scraper)
npm test

# Or run just the scraper project (auth runs as dependency)
npm run scrape:connections

### Output

Data files are saved to ./output as connections-<timestamp>.json and .csv

### Notes
- Headful mode is enabled to allow manual intervention at checkpoints/2FA.
- The auth state is stored in playwright/.auth/linkedin.json.
- Adjust timeouts and scrolling settings in src/scrapers/connections.ts and playwright.config.ts.

