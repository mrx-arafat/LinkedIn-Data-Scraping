import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { saveJSON, saveCSV } from '../../src/utils/save';

const OUT_DIR = path.resolve(process.cwd(), 'output');
const USERNAMES = [
  'jaindl',
  'theanishajain',
  'theadampeng',
  'jessectchan',
  'charlie-hills',
  'laraacostar',
  'mischa-collins',
  'ayesha-ameer',
  'marina-panova',
  'daniel-korenblum',
  'celesteyamile',
  'contentkuba'
];


// Use auth.json as primary auth file
const AUTH_STATE = path.resolve(process.cwd(), 'playwright/.auth/my-auth.json');

// Scraping configuration
const SCRAPING_CONFIG = {
  maxPosts: 10,  // Maximum number of posts to collect
  minLikes: 0,   // Minimum likes filter
  minComments: 0, // Minimum comments filter

  withMediaOnly: false, // Only posts with media
  withoutMediaOnly: false, // Only posts without media
  keyword: '', // Keyword filter for post text
};

test.use({ storageState: AUTH_STATE });

function cleanText(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function toAbs(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : new URL(url, 'https://www.linkedin.com').toString();
}

function extractUsernameFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/in\/([^\/?#]+)(?:[\/?#]|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function getProfileInfo(page: any) {
  try {
    // Get profile name from the page
    const nameSelectors = [
      'h1.text-heading-xlarge',
      '.pv-text-details__left-panel h1',
      '.profile-detail h1',
      'h1[class*="inline"]'
    ];

    let profileName = '';
    for (const selector of nameSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        profileName = await element.innerText().catch(() => '');
        if (profileName) break;
      }
    }

    // Get profile photo
    const photoSelectors = [
      'img.pv-top-card-profile-picture__image',
      'img.profile-photo-edit__preview',
      'img[class*="profile-picture"]'
    ];

    let profilePhoto = '';
    for (const selector of photoSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        profilePhoto = await element.getAttribute('src').catch(() => '');
        if (profilePhoto) break;
      }
    }

    return { name: profileName, photo: profilePhoto };
  } catch (e) {
    console.error('Error getting profile info:', e);
    return { name: '', photo: '' };
  }
}

async function getFollowersCount(page: any, username: string): Promise<string> {
  try {
    console.log(`📊 Getting followers count for ${username}...`);

    // Navigate to profile page first
    const profileUrl = `https://www.linkedin.com/in/${username}/`;
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for page to load
    await page.waitForSelector('main', { timeout: 10000 });

    // Multiple selectors for followers count
    const followersSelectors = [
      // Activity section followers
      '.pvs-header__optional-link:has-text("followers")',
      'p:has-text("followers")',
      // Profile header followers
      '.text-body-small:has-text("followers")',
      // Generic followers text
      '[aria-label*="followers"]',
      'span:has-text("followers")'
    ];

    let followersText = '';
    for (const selector of followersSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          followersText = await element.innerText();
          if (followersText && followersText.includes('followers')) {
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Extract number from text like "69,118 followers"
    const match = followersText.match(/([\d,]+)\s*followers/i);
    if (match) {
      return match[1]; // Return the number with commas
    }

    console.log('⚠️  Could not find followers count');
    return '0';
  } catch (error) {
    console.error('Error getting followers count:', error);
    return '0';
  }
}

async function navigateToRecentActivityAll(page: any, username: string) {
  console.log(`🔗 Navigating to ${username}'s recent activity...`);

  // Direct navigation to recent activity
  const url = `https://www.linkedin.com/in/${username}/recent-activity/all/`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Check if we hit auth wall
  const isAuthwall = page.url().includes('/authwall') || page.url().includes('/login');
  if (isAuthwall) {
    console.log('⚠️  Auth wall detected. Please run the login script first: npx tsx tests/auth/manual-login.ts');
    throw new Error('Not authenticated. Please login first.');
  }

  // Wait for main content
  await page.waitForSelector('main', { timeout: 10000 });
  console.log('✅ Page loaded successfully');
}

// Removed unused functions - simplified approach in scrollAndCollect

async function collectPostFromItem(page: any, node: any, sourceUsername: string) {
  try {
    // Get post text first (most important)
    const postText = cleanText(
      await node.locator('.feed-shared-text, .update-components-text, [dir="ltr"]').first().innerText().catch(() => '')
    ) || null;

    // Skip if no text content
    if (!postText || postText.length < 5) {
      return null;
    }

    // Author info - simplified
    const authorName = cleanText(
      await node.locator('.update-components-actor__name, .feed-shared-actor__name, [data-control-name="actor"] span').first().innerText().catch(() => sourceUsername)
    );

    // Post URL and ID - simplified
    let postId: string | null = null;
    let postUrl: string | null = null;

    // Try to get URN
    const urn = await node.getAttribute('data-urn').catch(() => null);
    if (urn) {
      const m = urn.match(/activity:(\d+)/);
      if (m) {
        postId = m[1];
        postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${postId}/`;
      }
    }

    // Timestamp
    const timestamp = await node.locator('time').first().innerText().catch(() => new Date().toISOString());

    // Social counts - simplified
    let reactionsCount = 0;
    let commentsCount = 0;

    // Try to get reaction count
    const reactionText = await node.locator('.social-details-social-counts__reactions, [aria-label*="reaction"]').first().innerText().catch(() => '');
    const reactionMatch = reactionText.match(/(\d+)/);
    if (reactionMatch) reactionsCount = parseInt(reactionMatch[1]);

    // Try to get comment count
    const commentText = await node.locator('.social-details-social-counts__comments, [aria-label*="comment"]').first().innerText().catch(() => '');
    const commentMatch = commentText.match(/(\d+)/);
    if (commentMatch) commentsCount = parseInt(commentMatch[1]);

    // Media - simplified
    const images: string[] = [];
    const imgElements = await node.locator('.update-components-image img, .feed-shared-image img').all().catch(() => []);
    for (const img of imgElements) {
      const src = await img.getAttribute('src').catch(() => null);
      if (src && !src.includes('profile-displayphoto') && !src.includes('static.licdn')) {
        images.push(src);
      }
    }

    return {
      authorName: authorName || sourceUsername,
      authorUsername: sourceUsername,
      postUrl,
      postText,
      timestamp,
      reactionsCount,
      commentsCount,
      repostsCount: 0,
      media: { images, videos: [] },
      attachments: [],
      postId,
      sourceUsername,
    };
  } catch (error) {
    console.log('Error collecting post:', error);
    return null;
  }
}

function hashFallback(text: string | null, timestamp: string | null): string | null {
  const basis = `${text || ''}__${timestamp || ''}`.trim();
  if (!basis) return null;
  return crypto.createHash('md5').update(basis).digest('hex');
}

async function scrollAndCollect(page: any, username: string, opts?: { maxToCollect?: number; maxPasses?: number; maxDurationMs?: number; filters?: any }) {
  const targetCount = opts?.maxToCollect ?? 10;
  const maxPasses = opts?.maxPasses ?? 20;

  const items: any[] = [];
  const seenTexts = new Set<string>();

  console.log(`📊 Collecting posts for user: ${username}`);
  console.log(`🎯 Maximum posts to collect for this user: ${targetCount}`);

  try {
    // Wait a bit for content to load
    await page.waitForTimeout(3000);

    // Initial scroll to trigger loading
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);

    // Wait for posts to be visible
    await page.waitForSelector('.feed-shared-update-v2, [data-urn*="activity"]', { timeout: 10000 });

    for (let pass = 0; pass < maxPasses && items.length < targetCount; pass++) {
      console.log(`\nPass ${pass + 1}:`);

      // Get all posts - use the selectors that worked in debug
      const posts = await page.$$('.feed-shared-update-v2[data-urn*="activity"]');
      console.log(`  Found ${posts.length} posts`);

      if (posts.length === 0) {
        console.log('  No posts found, scrolling...');
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(2000);
        continue;
      }

      // Process each post
      for (let i = 0; i < posts.length && items.length < targetCount; i++) {
        try {
          const postElement = posts[i];

          // Skip visibility check - just process the post

          // Extract post data using page.evaluate for better stability
          const postData = await page.evaluate((el: any) => {
            // Get text content - look for the actual post text
            const textSelectors = [
              '.feed-shared-text__text-view',
              '.feed-shared-text',
              '.update-components-text',
              '[data-test-id="main-feed-activity-content"]'
            ];
            let text = '';
            for (const sel of textSelectors) {
              const textEl = el.querySelector(sel);
              if (textEl && textEl.innerText) {
                text = textEl.innerText.trim();
                break;
              }
            }

            // Get author
            const authorSelectors = [
              '.update-components-actor__name',
              '.feed-shared-actor__name',
              '.update-components-actor__title',
              'a[data-control-name="actor"] span[aria-hidden="true"]'
            ];
            let author = '';
            for (const sel of authorSelectors) {
              const authorEl = el.querySelector(sel);
              if (authorEl && authorEl.innerText) {
                author = authorEl.innerText.trim();
                break;
              }
            }

            // Get timestamp
            const timeElement = el.querySelector('time');
            const timestamp = timeElement ? timeElement.innerText.trim() : '';

            // Get reactions
            const reactionSelectors = [
              '.social-details-social-counts__reactions',
              '[data-test-id="social-actions__reaction-count"]',
              '[aria-label*="reaction"]'
            ];
            let reactions = 0;
            for (const sel of reactionSelectors) {
              const reactEl = el.querySelector(sel);
              if (reactEl) {
                const match = reactEl.innerText.match(/(\d+)/);
                if (match) {
                  reactions = parseInt(match[1]);
                  break;
                }
              }
            }

            // Get comments
            const commentSelectors = [
              '.social-details-social-counts__comments',
              '[data-test-id="social-actions__comment-count"]',
              '[aria-label*="comment"]'
            ];
            let comments = 0;
            for (const sel of commentSelectors) {
              const commentEl = el.querySelector(sel);
              if (commentEl) {
                const match = commentEl.innerText.match(/(\d+)/);
                if (match) {
                  comments = parseInt(match[1]);
                  break;
                }
              }
            }

            // Get images
            const images = Array.from(el.querySelectorAll('.update-components-image img, .feed-shared-image img'))
              .map((img: any) => img.src)
              .filter((src: string) => src && !src.includes('profile-displayphoto') && !src.includes('static.licdn'));

            // Get URN
            const urn = el.getAttribute('data-urn') || '';
            const postId = urn.match(/activity:(\d+)/)?.[1] || null;

            return {
              text,
              author,
              timestamp,
              reactions,
              comments,
              images,
              postId,
              urn
            };
          }, postElement);

          // Skip if no text or already seen
          if (!postData.text || postData.text.length < 5) {
            console.log(`  Skipping post ${i}: no text`);
            continue;
          }
          if (seenTexts.has(postData.text)) {
            console.log(`  Skipping post ${i}: duplicate`);
            continue;
          }

          seenTexts.add(postData.text);

          // Create post object
          const post = {
            authorName: postData.author || username,
            authorUsername: username,
            postUrl: postData.postId ? `https://www.linkedin.com/feed/update/urn:li:activity:${postData.postId}/` : null,
            postText: postData.text,
            timestamp: postData.timestamp || new Date().toISOString(),
            reactionsCount: postData.reactions,
            commentsCount: postData.comments,
            repostsCount: 0,
            media: { images: postData.images, videos: [] },
            attachments: [],
            postId: postData.postId,
            sourceUsername: username,
          };

          items.push(post);
          console.log(`  ✅ Collected post ${items.length}: "${post.postText.substring(0, 50)}..."`);

          // Break immediately if we've reached the target count
          if (items.length >= targetCount) {
            console.log(`  🎯 Reached target count of ${targetCount} posts for ${username}`);
            break;
          }

        } catch (err) {
          console.log(`  ⚠️ Error processing post ${i}:`, err instanceof Error ? err.message : String(err));
        }
      }

      // Break if we've reached the target count
      if (items.length >= targetCount) {
        console.log(`\n🎯 Target reached: ${items.length}/${targetCount} posts collected for ${username}`);
        break;
      }

      // Scroll to load more
      if (items.length < targetCount) {
        console.log('  Scrolling to load more posts...');
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
        await page.waitForTimeout(2000 + Math.random() * 1000);
      }
    }

  } catch (error) {
    console.error('Error in scrollAndCollect:', error);
  }

  console.log(`\n✅ Scraping complete for ${username}! Collected ${items.length} posts`);
  return items;
}

// CSV header order requirement for posts
function reorderForCSV(rows: any[]) {
  const headers = [
    'authorName',
    'authorUsername',
    'authorFollowers',
    'postId',
    'postUrl',
    'timestamp',
    'postText',
    'reactionsCount',
    'commentsCount',
    'repostsCount',
    'images',
    'videos',
    'attachmentsTitles',
    'attachmentsUrls',
    'sourceUsername',
  ];
  return rows.map((r) => {
    const images = (r.media?.images || []).join(';');
    const videos = (r.media?.videos || []).join(';');
    const attachmentsTitles = (r.attachments || []).map((a: any) => a.title ?? '').join(';');
    const attachmentsUrls = (r.attachments || []).map((a: any) => a.url ?? '').join(';');
    return {
      authorName: r.authorName ?? '',
      authorUsername: r.authorUsername ?? '',
      authorFollowers: r.authorFollowers ?? '',
      postId: r.postId ?? '',
      postUrl: r.postUrl ?? '',
      timestamp: r.timestamp ?? '',
      postText: r.postText ?? '',
      reactionsCount: r.reactionsCount ?? '',
      commentsCount: r.commentsCount ?? '',
      repostsCount: r.repostsCount ?? '',
      images,
      videos,
      attachmentsTitles,
      attachmentsUrls,
      sourceUsername: r.sourceUsername ?? '',
    };
  });
}

// // Main test
// test.describe('LinkedIn Recent Activity - Posts scraper', () => {
//   test.setTimeout(15 * 60 * 1000);

//   test('scrape recent-activity posts for usernames', async ({ page }) => {
//     for (const username of USERNAMES) {
//       // For now collect only 2 posts quickly to validate parsing
//       const items = await scrollAndCollect(page, username, { maxToCollect: 2, maxPasses: 20, maxDurationMs: 90_000 });
//       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//       const jsonPath = path.join(OUT_DIR, `posts-${username}-${timestamp}.json`);
//       const csvPath = path.join(OUT_DIR, `posts-${username}-${timestamp}.csv`);

//       // Write JSON
//       await saveJSON(jsonPath, items);

//       // Write CSV with required column order
//       const csvRows = reorderForCSV(items);
//       await saveCSV(csvPath, csvRows);

//       // Expect at least one post for the username
//       expect(items.length).toBeGreaterThan(0);

//       console.log(`Saved posts for ${username}: JSON=${jsonPath} CSV=${csvPath} count=${items.length}`);
//     }
//   });
// });

// Main test
test.describe('LinkedIn Recent Activity - Posts scraper', () => {
  test.setTimeout(15 * 60 * 1000);

  test.beforeEach(async ({ page }) => {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('scrape recent-activity posts for usernames', async ({ page }) => {
    // Check if auth file exists
    if (!fs.existsSync(AUTH_STATE)) {
      console.error('❌ Auth file not found:', AUTH_STATE);
      console.error('Please run the authentication setup first');
      throw new Error('Authentication required. Run auth setup first.');
    }

    // Collect all posts from all users
    const allUsersPosts: any[] = [];
    const userStats: any = {};

    for (const username of USERNAMES) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📊 Starting scrape for user: ${username}`);
      console.log(`🎯 Target: ${SCRAPING_CONFIG.maxPosts} posts per user`);
      console.log(`${'═'.repeat(60)}\n`);

      try {
        // Get followers count first
        const followersCount = await getFollowersCount(page, username);
        console.log(`👥 Followers: ${followersCount}`);

        // Navigate and collect posts
        await navigateToRecentActivityAll(page, username);

        // Collect posts - use configuration
        const items = await scrollAndCollect(page, username, {
          maxToCollect: SCRAPING_CONFIG.maxPosts,  // Use configured max posts
          maxPasses: 20
        });

        // Add posts to combined collection with followers info
        const postsWithFollowers = items.map((post: any) => ({
          ...post,
          authorFollowers: followersCount
        }));
        allUsersPosts.push(...postsWithFollowers);

        // Store stats for this user
        userStats[username] = {
          followers: followersCount,
          totalPosts: items.length,
          postsWithMedia: items.filter((p: any) => p.media.images.length > 0 || p.media.videos.length > 0).length,
          avgReactions: items.reduce((sum: number, p: any) => sum + (p.reactionsCount || 0), 0) / items.length || 0,
          avgComments: items.reduce((sum: number, p: any) => sum + (p.commentsCount || 0), 0) / items.length || 0
        };

        // Log if user had fewer posts than configured maximum
        if (items.length < SCRAPING_CONFIG.maxPosts) {
          console.log(`\n⚠️  Note: ${username} had only ${items.length} posts available (less than configured max of ${SCRAPING_CONFIG.maxPosts})`);
        }

        // Log summary for this user
        console.log(`\n📈 Summary for ${username}:`);
        console.log(`   Followers: ${userStats[username].followers}`);
        console.log(`   Total posts collected: ${items.length}/${SCRAPING_CONFIG.maxPosts}`);
        console.log(`   Posts with media: ${userStats[username].postsWithMedia}`);
        console.log(`   Avg reactions: ${Math.round(userStats[username].avgReactions)}`);
        console.log(`   Avg comments: ${Math.round(userStats[username].avgComments)}`);

      } catch (error) {
        console.error(`❌ Error scraping ${username}:`, error);
        throw error;
      }
    }

    // Generate combined output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const usernamesStr = USERNAMES.join('-');
    const jsonPath = path.join(OUT_DIR, `posts-${usernamesStr}-${timestamp}.json`);
    const csvPath = path.join(OUT_DIR, `posts-${usernamesStr}-${timestamp}.csv`);

    // Create combined output
    const combinedOutput = {
      profiles: USERNAMES.map(username => ({
        username,
        stats: userStats[username] || { totalPosts: 0, postsWithMedia: 0, avgReactions: 0, avgComments: 0 }
      })),
      scrapedAt: new Date().toISOString(),
      totalPosts: allUsersPosts.length,
      posts: allUsersPosts
    };

    // Write JSON with full data
    await saveJSON(jsonPath, combinedOutput);

    // Write CSV with posts only
    const csvRows = reorderForCSV(allUsersPosts);
    await saveCSV(csvPath, csvRows);

    // Final summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ All users processed successfully!`);
    console.log(`   Total users scraped: ${USERNAMES.length}`);
    console.log(`   Users: ${USERNAMES.join(', ')}`);
    console.log(`   Total posts collected: ${allUsersPosts.length}`);
    console.log(`\n💾 Combined output files:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   CSV:  ${csvPath}`);
    console.log(`${'═'.repeat(60)}\n`);

    // Expect at least one post total
    expect(allUsersPosts.length).toBeGreaterThan(0);
  });
});
