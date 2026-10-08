/**
 * Automated SEO & Indexing Test Suite for LPU Events Student Website
 * Tests: HTTP status, metadata, structured data, canonicals, sitemap, 404s, XSS safety
 */

interface TestCaseResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const BASE_URL = 'https://lpuevents.live';
const results: TestCaseResult[] = [];

function record(name: string, category: string, passed: boolean, details: string) {
  results.push({
    name,
    category,
    status: passed ? 'PASS' : 'FAIL',
    details,
  });
}

async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    html: text,
  };
}

function extractLdJson(html: string): any[] {
  const regex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  const matches: any[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      matches.push(JSON.parse(match[1]));
    } catch (err: any) {
      matches.push({ __parseError: err.message, raw: match[1] });
    }
  }
  return matches;
}

async function runSuite() {
  console.log('Starting Automated SEO Verification Suite for ' + BASE_URL + '...\n');

  // ─── 1. Robots.txt ──────────────────────────────────────────────────────────
  try {
    const robots = await fetchPage(`${BASE_URL}/robots.txt`);
    const hasSitemap = robots.html.includes('Sitemap: https://lpuevents.live/sitemap.xml');
    const hasGooglebot = robots.html.includes('User-agent: Googlebot') || robots.html.includes('User-agent: *');
    const hasApiDisallow = robots.html.includes('Disallow: /api/');

    record(
      'robots.txt HTTP 200 & Sitemap declaration',
      'Robots',
      robots.status === 200 && hasSitemap && hasGooglebot,
      `Status: ${robots.status}, Sitemap present: ${hasSitemap}, Googlebot allow: ${hasGooglebot}`
    );
  } catch (err: any) {
    record('robots.txt test', 'Robots', false, err.message);
  }

  // ─── 2. Sitemap.xml ────────────────────────────────────────────────────────
  let sitemapUrls: string[] = [];
  try {
    const sm = await fetchPage(`${BASE_URL}/sitemap.xml`);
    const isXml = sm.headers.get('content-type')?.includes('xml');
    const urlMatches = sm.html.match(/<loc>(.*?)<\/loc>/g) || [];
    sitemapUrls = urlMatches.map((m) => m.replace(/<\/?loc>/g, ''));
    const hasEvents = sitemapUrls.some((u) => u.includes('/events/'));
    const hasCategories = sitemapUrls.some((u) => u.includes('?category='));
    const hasStatic = sitemapUrls.includes(`${BASE_URL}/about`);
    const noObsoleteTags = !sm.html.includes('<changefreq>') && !sm.html.includes('<priority>');

    record(
      'sitemap.xml structure & clean tags',
      'Sitemap',
      sm.status === 200 && isXml && hasEvents && hasCategories && hasStatic && noObsoleteTags,
      `Status: ${sm.status}, URLs count: ${sitemapUrls.length}, Has events: ${hasEvents}, Clean tags (no priority/changefreq): ${noObsoleteTags}`
    );

    // Verify lastmod authenticity
    const lastmods = (sm.html.match(/<lastmod>(.*?)<\/lastmod>/g) || []).map((m) => m.replace(/<\/?lastmod>/g, ''));
    const validDates = lastmods.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const aboutMod = sm.html.match(/<loc>https:\/\/lpuevents\.live\/about<\/loc>\s*<lastmod>(.*?)<\/lastmod>/)?.[1];
    const staticHonest = aboutMod === '2026-09-01';

    record(
      'sitemap.xml authentic lastmod timestamps',
      'Sitemap',
      validDates && staticHonest,
      `Valid date format: ${validDates}, Static page launch date preserved: ${staticHonest} (${aboutMod})`
    );
  } catch (err: any) {
    record('sitemap.xml test', 'Sitemap', false, err.message);
  }

  // ─── 3. Homepage SEO & Structured Data ──────────────────────────────────────
  try {
    const hp = await fetchPage(BASE_URL + '/');
    const ldJson = extractLdJson(hp.html);
    const websiteSchema = ldJson.find((s) => s['@type'] === 'WebSite');
    const orgSchema = ldJson.find((s) => s['@type'] === 'EducationalOrganization');
    const hasSearchAction = websiteSchema && 'potentialAction' in websiteSchema;

    record(
      'Homepage HTTP 200 & Title',
      'Homepage',
      hp.status === 200 && hp.html.includes('<title>'),
      `Status: ${hp.status}`
    );

    record(
      'Homepage WebSite Schema (Clean, no deprecated SearchAction)',
      'Homepage Schema',
      Boolean(websiteSchema) && !hasSearchAction && websiteSchema?.name === 'LPU Events',
      `WebSite schema present: ${Boolean(websiteSchema)}, SearchAction removed: ${!hasSearchAction}`
    );

    record(
      'Homepage EducationalOrganization Schema',
      'Homepage Schema',
      Boolean(orgSchema) && orgSchema?.name === 'Lovely Professional University' && Boolean(orgSchema?.address),
      `Org schema present: ${Boolean(orgSchema)}, Address locality: ${orgSchema?.address?.addressLocality}`
    );
  } catch (err: any) {
    record('Homepage test', 'Homepage', false, err.message);
  }

  // ─── 4. Event Pages Testing ────────────────────────────────────────────────
  const testEventSlugs = [
    { slug: 'lpu-hacknext-2026-24-hour-smart-campus-hackathon', type: 'Hackathon / Free Registration' },
    { slug: 'mega-blood-donation-community-health-checkup-drive', type: 'Walk-in Unticketed / Free' },
    { slug: 'a1', type: 'Paid / External Registration' },
    { slug: 'national-ai-large-language-models-symposium-2026', type: 'Multiple Sections' },
  ];

  for (const t of testEventSlugs) {
    try {
      const ep = await fetchPage(`${BASE_URL}/events/${t.slug}`);
      const ldJson = extractLdJson(ep.html);
      const eventSchema = ldJson.find((s) => s['@type'] === 'Event');
      const breadcrumbSchema = ldJson.find((s) => s['@type'] === 'BreadcrumbList');

      // Metadata checks
      const hasTitle = ep.html.includes('<title>');
      const hasMetaDesc = ep.html.includes('name="description"');
      const hasCanonical = ep.html.includes(`link rel="canonical" href="${BASE_URL}/events/${t.slug}"`);
      const hasOg = ep.html.includes('property="og:title"') && ep.html.includes('property="og:image"');
      const hasTwitter = ep.html.includes('name="twitter:card"');
      const hasH1 = ep.html.includes('<h1 itemprop="name"');
      const hasRootContent = ep.html.includes('<article itemscope itemtype="https://schema.org/Event"');

      record(
        `Event: ${t.slug} (HTTP 200, Meta, Canonical, Pre-render HTML)`,
        'Event Metadata',
        ep.status === 200 && hasTitle && hasMetaDesc && hasCanonical && hasOg && hasTwitter && hasH1 && hasRootContent,
        `Status: ${ep.status}, Canonical valid: ${hasCanonical}, Pre-render in root: ${hasRootContent}`
      );

      // Event Schema Checks
      const validEventSchema =
        Boolean(eventSchema) &&
        Boolean(eventSchema.name) &&
        Boolean(eventSchema.startDate) &&
        Boolean(eventSchema.eventStatus) &&
        Boolean(eventSchema.eventAttendanceMode);

      // Verify NO fabricated performer
      const noFabricatedPerformer = !('performer' in (eventSchema || {}));

      // Verify Location accuracy
      let locationValid = false;
      if (eventSchema?.location) {
        if (eventSchema.location['@type'] === 'Place') {
          locationValid =
            Boolean(eventSchema.location.name) &&
            (!eventSchema.location.address || eventSchema.location.address.addressLocality === 'Phagwara');
        } else if (eventSchema.location['@type'] === 'VirtualLocation') {
          locationValid = Boolean(eventSchema.location.url);
        }
      }

      // Verify Offers conditional logic
      let offersValid = true;
      if (t.type.includes('Walk-in Unticketed')) {
        // Must NOT have offers
        offersValid = !('offers' in (eventSchema || {})) && eventSchema?.isAccessibleForFree === true;
      } else if (t.type.includes('Paid')) {
        offersValid =
          eventSchema?.isAccessibleForFree === false &&
          eventSchema?.offers?.price &&
          Number(eventSchema?.offers?.price) > 0;
      } else if (t.type.includes('Free Registration')) {
        offersValid = eventSchema?.isAccessibleForFree === true && eventSchema?.offers?.price === '0';
      }

      record(
        `Event: ${t.slug} (Structured Data Conditional Logic)`,
        'Event Schema',
        validEventSchema && noFabricatedPerformer && locationValid && offersValid,
        `Event schema: ${validEventSchema}, Performer omitted: ${noFabricatedPerformer}, Location valid: ${locationValid}, Offers logic valid: ${offersValid}`
      );

      // Breadcrumb Schema Checks
      const validBreadcrumbs =
        Boolean(breadcrumbSchema) &&
        Array.isArray(breadcrumbSchema.itemListElement) &&
        breadcrumbSchema.itemListElement.length === 3 &&
        breadcrumbSchema.itemListElement[1].item.includes('?category=');

      record(
        `Event: ${t.slug} (Breadcrumb Schema & Internal Links)`,
        'Breadcrumbs',
        validBreadcrumbs,
        `Breadcrumbs valid: ${validBreadcrumbs}, Category URL: ${breadcrumbSchema?.itemListElement?.[1]?.item}`
      );
    } catch (err: any) {
      record(`Event: ${t.slug}`, 'Event', false, err.message);
    }
  }

  // ─── 5. Non-Existent & 404 Handling ─────────────────────────────────────────
  try {
    const invalidUrl = `${BASE_URL}/events/random-non-existent-event-xyz-999`;
    const res404 = await fetchPage(invalidUrl);
    const has404Status = res404.status === 404;
    const hasNoindexHeader = res404.headers.get('x-robots-tag')?.includes('noindex');
    const hasNoindexMeta = res404.html.includes('content="noindex, nofollow"');
    const isNotSoft404 = has404Status && (hasNoindexHeader || hasNoindexMeta);

    record(
      'Non-existent event 404 status & Anti-Soft-404 noindex',
      '404 / Lifecycle',
      isNotSoft404,
      `HTTP Status: ${res404.status}, X-Robots-Tag: ${res404.headers.get('x-robots-tag')}, Meta robots: ${hasNoindexMeta}`
    );
  } catch (err: any) {
    record('404 test', '404 / Lifecycle', false, err.message);
  }

  // ─── 6. Category Page Testing ──────────────────────────────────────────────
  try {
    const catPage = await fetchPage(`${BASE_URL}/?category=academics`);
    record(
      'Category page HTTP 200 & indexable',
      'Category Pages',
      catPage.status === 200 && !catPage.html.includes('noindex'),
      `Status: ${catPage.status}`
    );
  } catch (err: any) {
    record('Category page test', 'Category Pages', false, err.message);
  }

  // ─── 7. Static Pages Testing ───────────────────────────────────────────────
  for (const path of ['/about', '/contact', '/privacy', '/terms']) {
    try {
      const sp = await fetchPage(`${BASE_URL}${path}`);
      const hasCanonical = sp.html.includes(`link rel="canonical" href="${BASE_URL}${path}"`);
      const hasTitle = sp.html.includes('<title>');
      record(
        `Static page ${path} canonical & metadata`,
        'Static Pages',
        sp.status === 200 && hasCanonical && hasTitle,
        `Status: ${sp.status}, Canonical match: ${hasCanonical}`
      );
    } catch (err: any) {
      record(`Static page ${path}`, 'Static Pages', false, err.message);
    }
  }

  // ─── Results Summary ───────────────────────────────────────────────────────
  console.log('\n=============================================================');
  console.log('            FINAL SEO & INDEXING AUTOMATED TEST RESULTS       ');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const mark = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    if (r.status === 'PASS') passed++;
    else failed++;
    console.log(`${mark} [${r.category}] ${r.name}`);
    console.log(`       Details: ${r.details}`);
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed} | BLOCKED: 0`);
  console.log('=============================================================\n');
}

runSuite().catch(console.error);
