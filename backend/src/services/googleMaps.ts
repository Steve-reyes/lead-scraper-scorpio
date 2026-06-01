/**
 * Google Maps scraper — real browser-based extraction via Puppeteer + Chrome CDP.
 *
 * 1. Search Google Maps, scroll feed, collect listing cards with place URLs
 * 2. Open new tabs (parallel) to extract website from each place page
 * 3. Returns leads with name, address, rating, website
 */

import puppeteer, { Page, Browser } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { Lead, SearchRequest } from '../types';
import { normalizeBusinessName } from '../utils/validators';
import { getRandomUserAgent } from '../utils/userAgents';

const CHROME_CDP = process.env.CHROME_CDP_URL || 'ws://127.0.0.1:3012';

function delay(min = 2000, max = 5000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Aggressive scroll of the Google Maps results panel.
 * Tries multiple known selectors and multiple scroll passes.
 */
async function scrollResultsPanel(page: Page, count: number = 1): Promise<void> {
  const selectors = [
    'div[role="feed"]',
    'div.m6QErb[aria-label*="Results"]',
    'div.m6QErb',
    'div[aria-label*="Results"]',
    'div[aria-label*="resultados"]',
    'div.siAUzd',
  ];

  for (const sel of selectors) {
    const el = await page.$(sel).catch(() => null);
    if (el) {
      for (let i = 0; i < count; i++) {
        try {
          await page.evaluate((s: string) => {
            const c = document.querySelector(s);
            if (c) {
              // Scroll by a large chunk to trigger lazy loading
              c.scrollTop += c.scrollHeight * 0.8;
            }
          }, sel);
          await delay(300, 700);
        } catch { break; }
      }
      await delay(500, 1000);
      // Final scroll to bottom
      try {
        await page.evaluate((s: string) => {
          const c = document.querySelector(s);
          if (c) c.scrollTop = c.scrollHeight;
        }, sel);
      } catch {}
      return;
    }
  }
}

interface ListingRef {
  name: string;
  address: string;
  rating: number | undefined;
  reviewCount: number | undefined;
  placeId: string;
  placeUrl: string;
  website: string | null;
}

async function extractListingRefs(page: Page): Promise<ListingRef[]> {
  await delay(1000, 2000);
  return page.evaluate(() => {
    const items: ListingRef[] = [];
    let cards: Element[] = Array.from(document.querySelectorAll('div[role="article"].Nv2PK'));
    if (!cards.length) {
      const feed = document.querySelector('[role="feed"]');
      if (feed) cards = Array.from(feed.children).filter(c => c.tagName === 'DIV' && c.querySelector('a[href*="/maps/place/"]'));
    }
    if (!cards.length) {
      const found = document.querySelectorAll('a[href*="place/"][role="link"]');
      if (found.length) cards = Array.from(found).map(a => a.closest('div') || a);
    }
    cards.forEach(card => {
      const anchor = card.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null;
      let href = anchor?.href || '';
      let placeId = '';
      if (href) { const m = href.match(/!1s([^!]+)/); if (m) placeId = m[1]; }
      const nameEl = card.querySelector('.qBF1Pd, .fontHeadlineSmall');
      const name = nameEl?.textContent?.trim() || '';
      if (!name) return;
      const ratingEl = card.querySelector('.MW4etd');
      let rating: number | undefined;
      if (ratingEl) { const r = ratingEl.textContent?.trim().replace(',', '.');
        if (r) rating = parseFloat(r); }
      let reviewCount: number | undefined;
      const ct = card.textContent || '';
      const rm = ct.match(/\((\d+[\d,]*)\)/);
      if (rm) reviewCount = parseInt(rm[1].replace(/,/g, ''));
      // Extract address from card's full text content — GMaps nests address unpredictably
      const cardText = card.textContent || '';
      const addressChunks = cardText
        .split(/\n/)
        .map(s => s.trim())
        .filter(s => /^\d/.test(s) && /[A-Za-z]{3,}/.test(s) && s.length > 8 && s.length < 120)
        .filter(s => !/^\d[.,\d]/.test(s) || !s.includes('(')); // exclude rating "4,8(32)"
      let address = addressChunks[0] || '';
      // Try bullet-split fallback if no newline match
      if (!address) {
        const bulletParts = cardText.split('·').map(s => s.trim()).filter(s => /^\d/.test(s) && /[A-Za-z]/.test(s) && s.length > 8 && !s.match(/^\+?\d+$/));
        address = bulletParts[0] || '';
      }
      // Clean German locale text from address
      if (address) {
        // Strip leading category text before first bullet
        address = address.replace(/^[^·\n]+·\s*/, '').trim();
        // Strip opening hours suffix
        address = address.replace(/(Geschlossen|Öffnet|Rund um die Uhr).*$/i, '').trim();
        // Strip trailing phone
        address = address.replace(/\s*\+\d[\d\s\-\(\)]+$/, '').trim();
        // Remove leading icon character
        address = address.replace(/^[]\s*/, '').trim();
      }
      if (href && !href.startsWith('http')) href = 'https://www.google.com' + href;

      // Try to extract website directly from listing card
      let website: string | null = null;
      const allCardLinks = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]'));
      for (const link of allCardLinks) {
        const lh = link.href.trim();
        if (lh && lh.startsWith('http') && !lh.match(/google\./) && !lh.includes('gstatic') && !lh.includes('googleapis')) {
          website = lh;
          break;
        }
      }

      items.push({ name, address, rating, reviewCount, placeId, placeUrl: href, website });
    });
    return items;
  });
}

/**
 * Open a new browser tab, navigate to a GMaps place page, extract the website link.
 * Uses multiple strategies to find the website on modern Google Maps.
 */
async function extractWebsiteFromPlace(browser: Browser, placeUrl: string): Promise<string | null> {
  if (!placeUrl) return null;
  let tab: Page | null = null;
  try {
    tab = await browser.newPage();
    await tab.setUserAgent(getRandomUserAgent());
    await tab.goto(placeUrl, { waitUntil: 'networkidle2', timeout: 25000 });
    await delay(1500, 2500);

    const website = await tab.evaluate(() => {
      // Strategy 1: Look for <a> tag with aria-label containing "website"
      const ariaLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(
        'a[aria-label*="website" i], a[aria-label*="Website" i], a[aria-label*="Web" i]'
      ));
      for (const link of ariaLinks) {
        const href = link.href.trim();
        if (href && href.startsWith('http') && !href.match(/google\./) && !href.includes('gstatic')) {
          return href;
        }
      }

      // Strategy 2: Look for any link with data-tooltip="Website"
      const tipLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(
        '[data-tooltip*="Website" i], [data-tooltip*="website" i] a[href], a[data-tooltip*="Website" i]'
      )).filter(el => el.tagName === 'A');
      for (const link of tipLinks) {
        const href = link.href.trim();
        if (href && href.startsWith('http') && !href.match(/google\./)) return href;
      }

      // Strategy 3: Look for button that has role="link" and aria-label website
      const roleLinks = Array.from(document.querySelectorAll<HTMLElement>(
        'button[role="link"][aria-label*="website" i], button[role="link"][aria-label*="Website" i], [role="link"][aria-label*="website" i] a[href]'
      ));
      for (const el of roleLinks) {
        const a = el.tagName === 'A' ? (el as HTMLAnchorElement) : el.querySelector('a[href]');
        if (a) {
          const href = (a as HTMLAnchorElement).href.trim();
          if (href && href.startsWith('http') && !href.match(/google\./)) return href;
        }
      }

      // Strategy 4: Find the website section text and get adjacent link
      const allSections = Array.from(document.querySelectorAll('div, span'));
      for (const section of allSections) {
        const text = section.textContent?.toLowerCase() || '';
        if (text.includes('website') && section.querySelector('a[href]')) {
          const link = section.querySelector<HTMLAnchorElement>('a[href]');
          if (link) {
            const href = link.href.trim();
            if (href && href.startsWith('http') && !href.match(/google\./)) return href;
          }
        }
      }

      // Strategy 5: Fallback — first non-Google HTTP link on the page
      const allLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
      for (const link of allLinks) {
        const href = link.href.trim();
        if (href && href.startsWith('http') &&
            !href.match(/google\./) &&
            !href.includes('gstatic') &&
            !href.includes('googleapis') &&
            !href.includes('maps')) {
          return href;
        }
      }

      return null;
    });

    return website;
  } catch {
    return null;
  } finally {
    if (tab) { try { await tab.close(); } catch {} }
  }
}

/**
 * Search Google Maps — collect listings, extract websites in parallel via new tabs.
 */
export async function searchGoogleMaps(request: SearchRequest): Promise<Lead[]> {
  const { keyword, location, radiusKm, country } = request;
  const maxResults = (request.maxResults && request.maxResults > 0) ? request.maxResults : 150;
  console.log(`[GMaps] Searching for "${keyword}" in "${location}"...`);

  const seenNames = new Set<string>();
  let browser: Browser | null = null;
  let page: Page | null = null;
  const collectedRefs: ListingRef[] = [];

  try {
    // Discover CDP endpoint
    let browserWSEndpoint = CHROME_CDP;
    if (!/\/devtools\//.test(browserWSEndpoint)) {
      let baseUrl = browserWSEndpoint;
      if (baseUrl.startsWith('ws://')) baseUrl = 'http://' + baseUrl.slice(5);
      if (baseUrl.startsWith('wss://')) baseUrl = 'https://' + baseUrl.slice(6);
      if (!baseUrl.startsWith('http')) baseUrl = `http://${baseUrl}`;
      baseUrl = baseUrl.replace(/\/+$/, '');
      try {
        const resp = await fetch(`${baseUrl}/json/version`);
        const data = await resp.json() as { webSocketDebuggerUrl: string };
        browserWSEndpoint = data.webSocketDebuggerUrl;
      } catch {}
    }

    browser = await puppeteer.connect({ browserWSEndpoint, defaultViewport: { width: 1280, height: 800 } });
    page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());

    const searchTerm = radiusKm && radiusKm > 0 ? `${keyword} within ${radiusKm}km of ${location}` : `${keyword} ${location}`;
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;

    console.log(`[GMaps] Loading search page...`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000, 5000);

    // Cookie consent — multiple languages
    // Google now uses <input type="submit"> inside <form> (not <button>)
    try {
      const handled = await page.evaluate(() => {
        /***** Check <input type="submit"> (new Google consent format) *****/
        const inputList = Array.from(document.querySelectorAll('input[type="submit"]'));
        for (const el of inputList) {
          const input = el as HTMLInputElement;
          const v = (input.value || '').toLowerCase();
          if (v.includes('accept all') || v.includes('reject all') ||
              v.includes('alle akzeptieren') || v.includes('alle ablehnen') ||
              v.includes('aceptar todo') || v.includes('rechazar todo') ||
              v.includes('accepter tout') || v.includes('tout accepter') ||
              v.includes('accepteren')) {
            input.form!.submit();
            return true;
          }
        }
        /***** Fallback: check <button> elements (older format) *****/
        for (const btn of Array.from(document.querySelectorAll('button'))) {
          const t = btn.textContent?.toLowerCase() || '';
          if (t.includes('accept all') || t.includes('reject all') ||
              t.includes('aceptar todo') || t.includes('rechazar todo') ||
              t.includes('accepteren') || t.includes('alle akzeptieren') ||
              t.includes('accepter tout') || t.includes('tout accepter')) {
            (btn as HTMLButtonElement).click(); return true;
          }
        }
        return false;
      });
      if (handled) {
        console.log('[GMaps] Consent handled');
        await delay(2000, 3000);
        // Wait for redirect back to maps from consent page
        try {
          await page.waitForFunction(() => !window.location.href.includes('consent.google'), { timeout: 20000 });
          await delay(1000, 2000);
        } catch {
          console.log('[GMaps] Consent redirect timeout, continuing...');
        }
      }
    } catch {}

    // Wait for results
    try { await page.waitForSelector('[role="feed"]', { timeout: 20000 }); } catch {
      try { await page.waitForSelector('div[role="article"]', { timeout: 10000 }); } catch {}
    }
    await delay(2000, 4000);

    // Phase 1: Scroll + collect — aggressive scrolling
    let emptyScrolls = 0;
    const MAX_EMPTY = 5;  // More tolerance for empty scrolls before giving up
    let scrollPasses = 1;

    while (collectedRefs.length < maxResults && emptyScrolls < MAX_EMPTY) {
      const newRefs = await extractListingRefs(page);
      let added = 0;
      for (const ref of newRefs) {
        if (collectedRefs.length >= maxResults) break;
        const norm = normalizeBusinessName(ref.name);
        if (seenNames.has(norm) || !ref.placeUrl) continue;
        seenNames.add(norm);
        collectedRefs.push(ref);
        added++;
      }
      if (added === 0) { emptyScrolls++; } else { emptyScrolls = 0; }
      console.log(`[GMaps] Collected ${collectedRefs.length}/${maxResults}`);

      // Increase scroll aggressiveness as we go deeper
      scrollPasses = Math.min(3, Math.floor(collectedRefs.length / 50) + 1);
      await scrollResultsPanel(page, scrollPasses);

      // Random 2-4s delay between scrolls to avoid rate limiting
      await delay(2000, 4000);
    }

    console.log(`[GMaps] Collected ${collectedRefs.length} listings. Extracting websites...`);

    // Phase 2: Extract websites in parallel (3 tabs at a time)
    const CONCURRENT = 3;
    for (let i = 0; i < collectedRefs.length; i += CONCURRENT) {
      const batch = collectedRefs.slice(i, i + CONCURRENT);
      const results = await Promise.allSettled(
        batch.map((ref) => extractWebsiteFromPlace(browser!, ref.placeUrl))
      );
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          collectedRefs[i + idx].website = result.value;
        }
      });
    }

    // Log results
    for (const ref of collectedRefs) {
      if (ref.website) console.log(`  -> ${ref.name}: ${ref.website}`);
    }

  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error(`[GMaps] Error: ${msg}`);
    // If we collected some results before the crash, return them instead of nothing
    if (collectedRefs.length > 0) {
      console.log(`[GMaps] Returning ${collectedRefs.length} results collected before error.`);
    }
  } finally {
    if (page) { try { await page.close(); } catch {} }
  }

  // Build leads from whatever we collected (even partial)
  const leads: Lead[] = collectedRefs.map((ref) => ({
    id: uuidv4(),
    businessName: ref.name,
    normalizedName: normalizeBusinessName(ref.name),
    address: ref.address,
    city: location.split(',')[0].trim(),
    country: request.country || 'United States',
    website: ref.website || undefined,
    rating: ref.rating,
    reviewCount: ref.reviewCount,
    googlePlaceId: ref.placeId ? `ChIJ${ref.placeId}` : uuidv4(),
    socialLinks: {},
    sources: [{ type: 'google_maps', name: 'Google Maps' }],
    enrichmentStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  console.log(`[GMaps] Done. ${leads.length} results (${leads.filter(l => l.website).length} with websites).`);
  return leads;
}
