import { test, expect } from '@playwright/test';
import path from 'node:path';
import { saveCSV, saveJSON } from '../../src/utils/save';

// Uses storageState from playwright.config.ts (project: "scrape")

test.describe('LinkedIn Search Filters Pagination', () => {
  test.setTimeout(10 * 60 * 1000);

  test('scrape all search results across all pages', async ({ page }) => {
    // Navigate directly to the search results page (1st degree connections)
    await page.goto('https://www.linkedin.com/search/results/people/?network=%5B%22F%22%5D&origin=MEMBER_PROFILE_CANNED_SEARCH');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await expect(page.locator('main')).toBeVisible();

    // Initialize results array and tracking variables
    const allResults: Array<{
      name: string;
      headline: string;
      username: string;
      profileUrl: string;
      imageUrl?: string | null;
    }> = [];
    const processedUsernames = new Set<string>();
    let currentPage = 1;
    let hasNextPage = true;
    const maxPages = 100; // Safety limit to prevent infinite loops

    // Main pagination loop
    while (hasNextPage && currentPage <= maxPages) {
      console.log(`\nProcessing page ${currentPage}...`);

      // Wait for search results to load
      await page.waitForSelector('.search-results-container', { timeout: 10000 });

      // Get the first ul containing search results
      const resultsContainer = page.locator('.search-results-container ul').first();
      await expect(resultsContainer).toBeVisible();

      // Get all li elements that contain profile data (identified by data-chameleon-result-urn)
      const resultItems = resultsContainer.locator('li').filter({ has: page.locator('[data-chameleon-result-urn]') });
      const count = await resultItems.count();
      console.log(`Found ${count} result items on page ${currentPage}`);

      // Extract data from all results on this page
      const pageResults: typeof allResults = [];

      // Process all results on this page
      for (let i = 0; i < count; i++) {
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

        // Only add if we have at least a name and not already processed
        if (name && !processedUsernames.has(username)) {
          pageResults.push({
            name,
            headline,
            username,
            profileUrl: profileUrl.startsWith('http') ? profileUrl : `https://www.linkedin.com${profileUrl}`,
            imageUrl
          });
          processedUsernames.add(username);
        }
      } catch (error) {
        console.error(`Error processing item ${i} on page ${currentPage}:`, error);
      }
      }

      // Add page results to all results
      allResults.push(...pageResults);
      console.log(`Scraped ${pageResults.length} profiles from page ${currentPage}. Total so far: ${allResults.length}`);

      // Check if there's a next page
      const nextButton = page.locator('button[aria-label="Next"]').first();
      const isNextDisabled = await nextButton.evaluate(el =>
        el.hasAttribute('disabled') || el.classList.contains('artdeco-button--disabled')
      );

      if (!isNextDisabled && currentPage < maxPages) {
        // Click next and wait for navigation
        await nextButton.click();
        currentPage++;

        // Wait for the page to update
        await page.waitForTimeout(2000);

        // Wait for the new results to load
        await page.waitForSelector('.search-results-container', { timeout: 10000 });

        // Optional: wait for the page number to update in the pagination
        try {
          await page.waitForFunction(
            (pageNum) => {
              const pageState = document.querySelector('.artdeco-pagination__page-state');
              return pageState && pageState.textContent?.includes(`Page ${pageNum}`);
            },
            currentPage,
            { timeout: 5000 }
          );
        } catch (e) {
          console.log('Page state update not detected, continuing anyway...');
        }
      } else {
        hasNextPage = false;
        console.log('No more pages to process or reached max pages limit.');
      }
    }

    // Save all results to files
    const OUT_DIR = path.resolve(process.cwd(), 'output');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const jsonPath = path.join(OUT_DIR, `search-results-${timestamp}.json`);
    const csvPath = path.join(OUT_DIR, `search-results-${timestamp}.csv`);

    saveJSON(jsonPath, allResults);
    saveCSV(csvPath, allResults);

    console.log(`\nTotal profiles scraped: ${allResults.length} from ${currentPage} pages`);
    console.log('Results saved to:', { jsonPath, csvPath });

    // Verify we got results
    expect(allResults.length).toBeGreaterThan(0);
  });
});