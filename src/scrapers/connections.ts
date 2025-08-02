import { Page, expect } from '@playwright/test';
import { LinkedInConnection, ScrapeResult } from '../types/linkedin';
import { logger } from '../utils/logger';


const PROFILE_LINK_SEL = [
  '.mn-connection-card__details a.mn-connection-card__link[href*="/in/"]',
  'a[data-view-name="connections-profile"][href*="/in/"]',
  'a.mn-connection-card__link[href*="/in/"]',
  'main a[href*="/in/"]',
].join(',');

function cleanText(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

export async function navigateToConnections(page: Page) {
  await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('main')).toBeVisible();
}

export async function infiniteScroll(
  page: Page,
  opts?: { anchorSel?: string; delayMs?: number; maxNoGrowth?: number; maxScrolls?: number }
) {
  const anchorSel = opts?.anchorSel ?? PROFILE_LINK_SEL;
  const delayMs = opts?.delayMs ?? 1800; // be gentle
  const maxNoGrowth = opts?.maxNoGrowth ?? 25; // require many consecutive no-growth cycles
  const maxScrolls = opts?.maxScrolls ?? 1000; // hard cap

  let lastTotal = 0;
  let noGrowth = 0;

  for (let i = 0; i < maxScrolls; i++) {
    // Try scrolling the main container first (some lists are inside a scrollable main)
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) {
        (main as HTMLElement).scrollTop = (main as HTMLElement).scrollHeight;
      }
      window.scrollTo(0, document.body.scrollHeight);
    });
    // extra: try End key and mouse wheel to trigger lazy-loading
    await page.keyboard.press('End').catch(() => {});
    await page.mouse.wheel(0, 3000).catch(() => {});

    // Wait for content to load
    await page.waitForTimeout(delayMs + Math.floor(Math.random() * 800));

    const currentTotal = await page.locator(anchorSel).count();
    logger.info(`Scroll ${i + 1}: loaded anchors=${currentTotal}`);

    if (currentTotal > lastTotal) {
      lastTotal = currentTotal;
      noGrowth = 0;
    } else {
      noGrowth++;
    }

    if (noGrowth >= maxNoGrowth) break;
  }

  // Final small wait to catch any in-flight requests
  await page.waitForTimeout(1500);
}

function extractProfileUrlsFromText(text: string): string[] {
  const absRe = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[^"'<>\s\\]+/gi;
  const relRe = /\/in\/[^"'<>\s\\]+/gi;
  const urls = new Set<string>();

  const add = (raw: string) => {
    const cleaned = raw.replace(/[),.;]+$/g, '');
    const absolute = cleaned.startsWith('http') ? cleaned : new URL(cleaned, 'https://www.linkedin.com').toString();
    urls.add(absolute);
  };

  for (const m of text.match(absRe) || []) add(m);
  for (const m of text.match(relRe) || []) add(m);

  return Array.from(urls);
}

function extractUsernameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/in\/([^\/]+)\/?/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function getConnectionUrls(page: Page): Promise<string[]> {
  const links = page.locator(PROFILE_LINK_SEL);
  // Evaluate all at once to avoid navigation/context issues during iteration
  const hrefs = await links.evaluateAll((els) =>
    (els as Element[])
      .map((el) => (el as HTMLAnchorElement).href || (el.getAttribute('href') || ''))
      .filter((h) => !!h)
  );
  const urls = new Set<string>();
  for (const href of hrefs as string[]) {
    const absolute = href.startsWith('http') ? href : new URL(href, 'https://www.linkedin.com').toString();
    urls.add(absolute);
  }
  return Array.from(urls);
}

export async function collectConnections(page: Page): Promise<LinkedInConnection[]> {
  // Iterate the text anchors inside each connection entry (per provided HTML)
  const linkSel = 'a[data-view-name="connections-profile"]';
  const anchors = page.locator(linkSel);
  const n = await anchors.count();
  logger.info(`Found ${n} connection anchors before extraction`);

  const seen = new Set<string>();
  const results: LinkedInConnection[] = [];

  for (let i = 0; i < n; i++) {
    const a = anchors.nth(i);

    // Skip avatar-only anchors (those with figure but no <p>)
    const pCount = await a.locator('p').count();
    if (pCount === 0) continue;

    const href = await a.getAttribute('href');
    if (!href) continue;
    const absolute = href.startsWith('http') ? href : new URL(href, 'https://www.linkedin.com').toString();
    if (seen.has(absolute)) continue;
    seen.add(absolute);

    // Name is inside first <p> often nested <a>
    let name = '';
    let headline: string | null = null;
    name = cleanText(await a.locator('p a').first().innerText().catch(async () => await a.locator('p').first().innerText().catch(() => '')));
    if (pCount > 1) {
      headline = cleanText(await a.locator('p').nth(1).innerText().catch(() => '')) || null;
    }

    const username = extractUsernameFromUrl(absolute);
    results.push({ name, headline, username, profileUrl: absolute });
  }

  return results;
}

async function enrichConnections(page: Page, items: LinkedInConnection[], opts?: { concurrency?: number; onlyMissing?: boolean }) {
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 2, 5));
  const onlyMissing = opts?.onlyMissing ?? true;

  const tasks = items.map((item) => async () => {
    if (onlyMissing && item.name && item.headline) return;
    try {
      const p = await page.context().newPage();
      await p.goto(item.profileUrl, { waitUntil: 'domcontentloaded' });

      // Name candidates
      const nameSelectors = [
        'h1',
        '.pv-text-details__left-panel h1',
        'div.ph5 h1',
      ];
      let name = '';
      for (const sel of nameSelectors) {
        if (await p.locator(sel).first().isVisible().catch(() => false)) {
          name = cleanText(await p.locator(sel).first().innerText().catch(() => ''));
          if (name) break;
        }
      }

      // Headline candidates
      const headlineSelectors = [
        '.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        '.pv-text-details__subtitle',
      ];
      let headline = '';
      for (const sel of headlineSelectors) {
        if (await p.locator(sel).first().isVisible().catch(() => false)) {
          headline = cleanText(await p.locator(sel).first().innerText().catch(() => ''));
          if (headline) break;
        }
      }

      if (!item.name && name) item.name = name;
      if (!item.headline && headline) item.headline = headline;

      await p.close();
      await page.waitForTimeout(300 + Math.floor(Math.random() * 400));
    } catch (e) {
      logger.warn(`Enrich failed for ${item.profileUrl}: ${(e as Error).message}`);
    }
  });

  // Run with limited concurrency
  const queue = tasks.slice();
  const runners: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    runners.push((async function run() {
      while (queue.length) {
        const t = queue.shift();
        if (!t) break;
        await t();
      }
    })());
  }
  await Promise.all(runners);
}

export async function scrapeConnections(
  page: Page,
  opts?: { delayMs?: number; maxNoGrowth?: number; maxScrolls?: number; enrichProfiles?: boolean; enrichConcurrency?: number }
): Promise<ScrapeResult<LinkedInConnection>> {
  const start = Date.now();
  await navigateToConnections(page);

  // Read target total from header if present
  let targetTotal: number | null = null;
  try {
    const header = page.locator('header.mn-connections__header h1');
    if (await header.isVisible().catch(() => false)) {
      const text = (await header.innerText().catch(() => '')).trim();
      const m = text.match(/(\d[\d,]*)\s+Connections/i);
      if (m) targetTotal = parseInt(m[1].replace(/,/g, ''), 10);
    } else {
      const mainText = (await page.locator('main').innerText().catch(() => '')).trim();
      const m2 = mainText.match(/(\d[\d,]*)\s+connections/i);
      if (m2) targetTotal = parseInt(m2[1].replace(/,/g, ''), 10);
    }
  } catch {}

  // Warm up: wait until at least some connections are visible (any profile link)
  try {
    await page.waitForSelector(PROFILE_LINK_SEL, { timeout: 45_000 });
  } catch {
    logger.warn('No profile anchors detected during warm-up; continuing to scroll');
  }

  // Scroll until we reach the targetTotal or no more growth, tracking unique URLs across passes
  let last = 0;
  const uniqueUrls = new Set<string>();

  // Capture RSC pagination responses to extract profile URLs from the payload
  const handleResponse = async (resp: any) => {
    try {
      const req = resp.request();
      if (req.method() === 'POST' && resp.url().includes('/rsc-action/actions/pagination') && resp.url().includes('mynetwork.connectionsList')) {
        const text = await resp.text().catch(() => '');
        if (text) {
          let added = 0;
          for (const u of extractProfileUrlsFromText(text)) {
            const before = uniqueUrls.size;
            uniqueUrls.add(u);
            if (uniqueUrls.size > before) added++;
          }
          if (added) logger.debug(`Captured ${added} URLs from RSC pagination. Total: ${uniqueUrls.size}`);
        }
      }
    } catch {}
  };
  page.on('response', handleResponse);

  for (let pass = 0; pass < (opts?.maxScrolls ?? 400); pass++) {
    await infiniteScroll(page, {
      delayMs: opts?.delayMs ?? 700,
      maxNoGrowth: 3,
      maxScrolls: 20,
    });

    // Parse main text for any hidden /in/ URLs (fallback)
    try {
      const bodyText = await page.locator('main').innerText({ timeout: 5_000 }).catch(() => '');
      if (bodyText) {
        for (const u of extractProfileUrlsFromText(bodyText)) uniqueUrls.add(u);
      }
    } catch {}

    for (const u of await getConnectionUrls(page)) uniqueUrls.add(u);

    const itemsNow = await collectConnections(page);
    for (const it of itemsNow) uniqueUrls.add(it.profileUrl);

    const seen = uniqueUrls.size;
    logger.info(`Pass ${pass + 1}: seen ${seen} unique profile URLs (target: ${targetTotal ?? 'unknown'})`);
    if (targetTotal && seen >= targetTotal) break;
    if (seen <= last) break; // no more growth
    last = seen;
  }

  page.off('response', handleResponse);

  // Collect items from DOM, then ensure any missing URLs are added as bare items
  const items = await collectConnections(page);
  const present = new Set(items.map(i => i.profileUrl));
  for (const u of uniqueUrls) if (!present.has(u)) items.push({ name: '', headline: null, username: extractUsernameFromUrl(u), profileUrl: u });

  // Enrichment intentionally disabled for speed unless explicitly requested
  if (opts?.enrichProfiles) {
    logger.info('Enrichment requested but skipped for fast extraction on connections page only.');
  }

  return { items, total: items.length, durationMs: Date.now() - start };
}

