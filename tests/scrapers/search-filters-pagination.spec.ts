import { test, expect } from '@playwright/test';
import path from 'node:path';
import { saveCSV, saveJSON } from '../../src/utils/save';

// Uses storageState from playwright.config.ts (project: "scrape")

test.describe('LinkedIn Search Filters Pagination', () => {
  test.setTimeout(10 * 60 * 1000);

  test('scrape search results from first page', async ({ page }) => {
    // Navigate directly to the search results page (1st degree connections)
    await page.goto('https://www.linkedin.com/search/results/people/?network=%5B%22F%22%5D&origin=MEMBER_PROFILE_CANNED_SEARCH');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await expect(page.locator('main')).toBeVisible();

    // Wait for search results to load
    await page.waitForSelector('.search-results-container', { timeout: 10000 });

    // Get the first ul containing search results
    const resultsContainer = page.locator('.search-results-container ul').first();
    await expect(resultsContainer).toBeVisible();

    // Get all li elements that contain profile data (identified by data-chameleon-result-urn)
    const resultItems = resultsContainer.locator('li').filter({ has: page.locator('[data-chameleon-result-urn]') });
    const count = await resultItems.count();
    console.log(`Found ${count} result items`);

    // Extract data from first 10 results
    const results: Array<{
      name: string;
      headline: string;
      username: string;
      profileUrl: string;
      imageUrl?: string | null;
    }> = [];

    const maxResults = Math.min(10, count);

    for (let i = 0; i < maxResults; i++) {
      const item = resultItems.nth(i);

      try {
        // Get the entity result container
        const entityResult = item.locator('[data-chameleon-result-urn]').first();

        // Get the main profile link - look for the link that contains the profile name
        // This is typically the second link after the image link
        const profileLinks = await entityResult.locator('a[href*="/in/"]').all();
        let profileUrl = '';
        let name = '';

        // Find the link with the name (usually has span[aria-hidden="true"])
        for (const link of profileLinks) {
          const nameSpan = link.locator('span[aria-hidden="true"]').first();
          if (await nameSpan.count() > 0) {
            const spanText = await nameSpan.textContent();
            if (spanText && spanText.trim() && !spanText.includes('View')) {
              name = spanText.trim();
              profileUrl = await link.getAttribute('href') || '';
              break;
            }
          }
        }

        // Get headline - look for the text content div after the name
        let headline = '';
        const headlineDiv = entityResult.locator('.t-14.t-black.t-normal').first();
        if (await headlineDiv.count() > 0) {
          const headlineText = await headlineDiv.textContent();
          if (headlineText) {
            headline = headlineText.trim();
          }
        }

        // Extract username from profile URL
        let username = '';
        const urlMatch = profileUrl.match(/\/in\/([^/?#]+)/);
        if (urlMatch) {
          username = urlMatch[1];
        }

        // Try to get image URL if exists
        let imageUrl: string | null = null;
        const imgElement = item.locator('img').first();
        if (await imgElement.count() > 0) {
          imageUrl = await imgElement.getAttribute('src');
          // Skip data URLs
          if (imageUrl && imageUrl.startsWith('data:')) {
            imageUrl = null;
          }
        }

        // Only add if we have at least a name
        if (name) {
          results.push({
            name,
            headline,
            username,
            profileUrl: profileUrl.startsWith('http') ? profileUrl : `https://www.linkedin.com${profileUrl}`,
            imageUrl
          });
        }
      } catch (error) {
        console.error(`Error processing item ${i}:`, error);
      }
    }

    // Save results to files
    const OUT_DIR = path.resolve(process.cwd(), 'output');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const jsonPath = path.join(OUT_DIR, `search-results-${timestamp}.json`);
    const csvPath = path.join(OUT_DIR, `search-results-${timestamp}.csv`);

    saveJSON(jsonPath, results);
    saveCSV(csvPath, results);

    console.log(`Scraped ${results.length} profiles`);
    console.log('Results saved to:', { jsonPath, csvPath });

    // Verify we got results
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(10);
  });
});