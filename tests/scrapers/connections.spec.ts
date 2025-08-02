import { test, expect } from '@playwright/test';
import path from 'node:path';
import { logger } from '../../src/utils/logger';
import { saveCSV, saveJSON } from '../../src/utils/save';
import { scrapeConnections } from '../../src/scrapers/connections';

const OUT_DIR = path.resolve(process.cwd(), 'output');

test.use({ storageState: path.resolve(process.cwd(), 'playwright/.auth/auth.json') });

test.describe('LinkedIn Connections Scraper', () => {
  test.setTimeout(10 * 60 * 1000);
  test('scrape all connections', async ({ page }) => {
    logger.info('Starting connections scrape');
    const res = await scrapeConnections(page, { delayMs: 700, maxNoGrowth: 3, maxScrolls: 500, enrichProfiles: false });

    logger.info(`Scraped ${res.total} connections in ${res.durationMs}ms`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const jsonPath = path.join(OUT_DIR, `connections-${timestamp}.json`);
    const csvPath = path.join(OUT_DIR, `connections-${timestamp}.csv`);

    saveJSON(jsonPath, res.items);
    saveCSV(csvPath, res.items);

    expect(res.total).toBeGreaterThan(0);
  });
});

