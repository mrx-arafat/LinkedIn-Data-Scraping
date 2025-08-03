# LinkedIn Data Scraping - Search Filters with Pagination

A Playwright-based automation tool to scrape LinkedIn 1st-degree connections with full pagination support.

**Author:** Easin Arafat ([@mrx-arafat](https://github.com/mrx-arafat))

## 🚀 Features

- Scrapes ALL 1st-degree LinkedIn connections across all pages
- Handles pagination automatically
- Deduplicates results by username
- Exports data in both JSON and CSV formats
- Robust error handling and retry mechanisms
- Uses authenticated sessions for reliable access

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A LinkedIn account
- Git

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mrx-arafat/LinkedIn-Data-Scraping.git
   cd LinkedIn-Data-Scraping
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npx playwright install chromium
   ```

## 🔐 Authentication Setup

Before running the scraper, you need to authenticate with LinkedIn:

1. **Run the authentication setup**
   ```bash
   npx playwright test tests/auth/global.auth.setup.ts --project=auth
   ```

2. **Manual login**
   - A browser window will open
   - Log in to your LinkedIn account manually
   - Complete any 2FA if required
   - The session will be saved automatically

3. **Verify authentication**
   ```bash
   npx playwright test tests/auth/save.auth.setup.ts --project=auth-save
   ```

## 🏃‍♂️ Running the Search Filters Pagination Scraper

### Quick Start

Run the scraper using npm script (Recommended):
```bash
npm run scrape:connections-via-pagination
```

Or run directly with Playwright:
```bash
npx playwright test tests/scrapers/search-filters-pagination.spec.ts --project=scrape
```

### With Extended Timeout (for large datasets)

```bash
npx playwright test tests/scrapers/search-filters-pagination.spec.ts --project=scrape --timeout=300000
```

### Run in UI Mode (for debugging)

```bash
npx playwright test tests/scrapers/search-filters-pagination.spec.ts --project=scrape --ui
```

### Run with Trace (for detailed debugging)

```bash
npx playwright test tests/scrapers/search-filters-pagination.spec.ts --project=scrape --trace on
```

## 📊 Output

The scraper saves results in the `output/` directory with timestamped filenames:

- `search-results-YYYY-MM-DDTHH-mm-ss-sssZ.json` - JSON format
- `search-results-YYYY-MM-DDTHH-mm-ss-sssZ.csv` - CSV format

### Data Fields

Each scraped profile contains:
- `name` - Full name of the connection
- `headline` - Professional headline
- `username` - LinkedIn username (from profile URL)
- `profileUrl` - Full LinkedIn profile URL
- `imageUrl` - Profile picture URL (if available)

### Example Output

```json
[
  {
    "name": "John Doe",
    "headline": "Software Engineer at Tech Company",
    "username": "johndoe",
    "profileUrl": "https://www.linkedin.com/in/johndoe",
    "imageUrl": "https://media.licdn.com/..."
  }
]
```

## ⚙️ Configuration

### Playwright Config

The scraper uses the `scrape` project configuration from `playwright.config.ts`:

```typescript
{
  name: 'scrape',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'auth.json',
  },
  dependencies: ['auth'],
}
```

### Scraper Settings

You can modify these settings in `tests/scrapers/search-filters-pagination.spec.ts`:

```typescript
const maxPages = 100; // Maximum pages to scrape (safety limit)
```

## 🐛 Troubleshooting

### Authentication Issues

If you encounter authentication errors:
1. Delete the `auth.json` file
2. Re-run the authentication setup
3. Make sure to complete the login process fully

### Timeout Errors

For large datasets, increase the timeout:
```bash
npx playwright test tests/scrapers/search-filters-pagination.spec.ts --project=scrape --timeout=600000
```

### Rate Limiting

If LinkedIn rate limits your requests:
- The scraper includes built-in delays between pages
- You can increase delays by modifying the `waitForTimeout` values

### No Results Found

Ensure you have 1st-degree connections by checking:
```
https://www.linkedin.com/search/results/people/?network=%5B%22F%22%5D
```

## 📁 Project Structure

```
LinkedIn-Data-Scraping/
├── tests/
│   ├── auth/
│   │   ├── global.auth.setup.ts    # Initial authentication
│   │   └── save.auth.setup.ts      # Save auth state
│   └── scrapers/
│       └── search-filters-pagination.spec.ts  # Main scraper
├── src/
│   └── utils/
│       └── save.ts                 # File saving utilities
├── output/                         # Scraped data output
├── playwright.config.ts            # Playwright configuration
├── auth.json                       # Saved authentication state
└── package.json
```

## 🔧 Advanced Usage

### Custom Search URLs

To scrape different search results, modify the URL in the test file:
```typescript
await page.goto('YOUR_CUSTOM_LINKEDIN_SEARCH_URL');
```

### Parallel Execution

The scraper processes pages sequentially to avoid rate limiting. Item extraction within each page uses concurrent processing for speed.

### Debugging

Enable verbose logging:
```bash
DEBUG=pw:api npx playwright test tests/scrapers/search-filters-pagination.spec.ts --project=scrape
```

## 📝 Notes

- The scraper respects LinkedIn's structure and uses stable selectors
- Deduplication is performed by username to avoid duplicate entries
- The scraper will stop when:
  - The "Next" button is disabled
  - No new results are found
  - Maximum page limit is reached

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is for educational purposes. Please respect LinkedIn's Terms of Service and use responsibly.

---

**Created by:** Easin Arafat ([@mrx-arafat](https://github.com/mrx-arafat))
