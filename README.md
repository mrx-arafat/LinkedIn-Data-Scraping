# LinkedIn Data Scraping Suite

A comprehensive Playwright-based automation toolkit for scraping LinkedIn data including connections, search results, and posts.

**Author:** Easin Arafat ([@mrx-arafat](https://github.com/mrx-arafat))

## 🚀 Features

### Three Powerful Scrapers:

1. **Connections Scraper** - Scrape all your LinkedIn connections with profile enrichment
2. **Search Filters Pagination Scraper** - Scrape search results with advanced filtering and pagination
3. **Posts Scraper** - Scrape recent activity posts from specific LinkedIn profiles

### Core Features:
- Handles pagination automatically across all scrapers
- Deduplicates results by username
- Exports data in both JSON and CSV formats
- Robust error handling and retry mechanisms
- Uses authenticated sessions for reliable access
- Anti-detection measures built-in

## 🎯 Quick Overview

| Scraper | Purpose | Command | Output Files |
|---------|---------|---------|--------------|
| **Connections** | Scrape all your LinkedIn connections | `npm run scrape:connections` | `connections-*.json/csv` |
| **Search Filters** | Scrape search results with pagination | `npm run scrape:connections-via-pagination` | `search-results-*.json/csv` |
| **Posts** | Scrape posts from specific profiles | `npm run scrape:posts` | `posts-*.json/csv` |

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

## 🏃‍♂️ Running the Scrapers

### 1. Connections Scraper

Scrapes all your LinkedIn connections with profile enrichment.

**Quick Start:**
```bash
npm run scrape:connections
```

**Direct run:**
```bash
npx playwright test tests/scrapers/connections.spec.ts --project=scrape
```

### 2. Search Filters Pagination Scraper

Scrapes search results with advanced filtering and full pagination support.

**Quick Start:**
```bash
npm run scrape:connections-via-pagination
```

**Direct run:**
```bash
npx playwright test tests/scrapers/search-filters-pagination.spec.ts --project=scrape
```

**With Extended Timeout (for large datasets):**
```bash
npx playwright test tests/scrapers/search-filters-pagination.spec.ts --project=scrape --timeout=500000
```

### 3. Posts Scraper

Scrapes recent activity posts from specific LinkedIn profiles.

**Quick Start:**
```bash
npm run scrape:posts
```

**Direct run:**
```bash
npx playwright test tests/scrapers/post-scraping.spec.ts --project=scrape
```

**With Extended Timeout (for profiles with many posts):**
```bash
npx playwright test tests/scrapers/post-scraping.spec.ts --project=scrape --timeout=900000
```

### Debugging Options (All Scrapers)

**Run in UI Mode:**
```bash
npx playwright test tests/scrapers/[scraper-file].spec.ts --project=scrape --ui
```

**Run with Trace:**
```bash
npx playwright test tests/scrapers/[scraper-file].spec.ts --project=scrape --trace on
```

## 📊 Output

All scrapers save results in the `output/` directory with timestamped filenames.

### 1. Connections Scraper Output

**Files:**
- `connections-YYYY-MM-DDTHH-mm-ss-sssZ.json` - JSON format
- `connections-YYYY-MM-DDTHH-mm-ss-sssZ.csv` - CSV format

**Data Fields:**
- `name` - Full name of the connection
- `headline` - Professional headline
- `location` - Location information
- `profileUrl` - Full LinkedIn profile URL
- `connectionDegree` - Connection degree (1st, 2nd, etc.)
- `connectedTime` - When you connected (if available)
- `imageUrl` - Profile picture URL

### 2. Search Filters Pagination Output

**Files:**
- `search-results-YYYY-MM-DDTHH-mm-ss-sssZ.json` - JSON format
- `search-results-YYYY-MM-DDTHH-mm-ss-sssZ.csv` - CSV format

**Data Fields:**
- `name` - Full name of the person
- `headline` - Professional headline
- `username` - LinkedIn username (from profile URL)
- `profileUrl` - Full LinkedIn profile URL
- `imageUrl` - Profile picture URL (if available)

### 3. Posts Scraper Output

**Files:**
- `posts-YYYY-MM-DDTHH-mm-ss-sssZ.json` - JSON format
- `posts-YYYY-MM-DDTHH-mm-ss-sssZ.csv` - CSV format

**Data Fields:**
- `authorName` - Name of the post author
- `authorHeadline` - Author's professional headline
- `postTime` - When the post was published
- `postContent` - Full text content of the post
- `likes` - Number of likes
- `comments` - Number of comments
- `reposts` - Number of reposts
- `postUrl` - Direct link to the post

### Example Outputs

**Connections/Search Results:**
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

**Posts:**
```json
[
  {
    "authorName": "Jane Smith",
    "authorHeadline": "Product Manager at Tech Corp",
    "postTime": "2d",
    "postContent": "Excited to share our latest product launch...",
    "likes": 245,
    "comments": 32,
    "reposts": 15,
    "postUrl": "https://www.linkedin.com/feed/update/..."
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

**Connections Scraper** (`tests/scrapers/connections.spec.ts`):
```typescript
// Modify the connections page URL if needed
await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/');
```

**Search Filters Pagination** (`tests/scrapers/search-filters-pagination.spec.ts`):
```typescript
const maxPages = 100; // Maximum pages to scrape (safety limit)
// Modify search URL for different filters
await page.goto('https://www.linkedin.com/search/results/people/?network=%5B%22F%22%5D');
```

**Posts Scraper** (`tests/scrapers/post-scraping.spec.ts`):
```typescript
// Change the profile URL to scrape different profiles
await page.goto('https://www.linkedin.com/in/[username]/recent-activity/all/');
const maxScrolls = 10; // Maximum scroll attempts
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
│       ├── connections.spec.ts              # Connections scraper
│       ├── search-filters-pagination.spec.ts # Search results scraper
│       └── post-scraping.spec.ts            # Posts scraper
├── src/
│   └── utils/
│       └── save.ts                 # File saving utilities
├── output/                         # Scraped data output
├── playwright.config.ts            # Playwright configuration
├── auth.json                       # Saved authentication state
└── package.json
```

## 🔧 Advanced Usage

### Custom URLs

**For Search Results:**
```typescript
// In search-filters-pagination.spec.ts
await page.goto('YOUR_CUSTOM_LINKEDIN_SEARCH_URL');
```

**For Posts from Different Profiles:**
```typescript
// In post-scraping.spec.ts
await page.goto('https://www.linkedin.com/in/[username]/recent-activity/all/');
```

### Parallel Execution

All scrapers process data sequentially to avoid rate limiting. Item extraction within each page uses concurrent processing for speed.

### Debugging

Enable verbose logging for any scraper:
```bash
DEBUG=pw:api npx playwright test tests/scrapers/[scraper-file].spec.ts --project=scrape
```

### Custom Data Extraction

You can modify the data extraction logic in each scraper to capture additional fields:

**Example - Adding company info to connections scraper:**
```typescript
const company = await item.$eval('.entity-result__primary-subtitle', el => el.textContent?.trim())
  .catch(() => null);
```

## 📝 Notes

### General
- All scrapers respect LinkedIn's structure and use stable selectors
- Built-in delays between requests to avoid rate limiting
- Robust error handling with retry mechanisms

### Connections Scraper
- Processes all connections from your network
- Handles lazy-loaded content automatically
- Extracts enriched profile data

### Search Filters Pagination Scraper
- Deduplication is performed by username to avoid duplicate entries
- The scraper will stop when:
  - The "Next" button is disabled
  - No new results are found
  - Maximum page limit is reached

### Posts Scraper
- Scrolls through activity feed to load more posts
- Extracts engagement metrics (likes, comments, reposts)
- Handles various post types (text, images, articles)
- Stops when maximum scroll limit is reached or no new posts load

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is for educational purposes. Please respect LinkedIn's Terms of Service and use responsibly.

---

**Created by:** Easin Arafat ([@mrx-arafat](https://github.com/mrx-arafat))
