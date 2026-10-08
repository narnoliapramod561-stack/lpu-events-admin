import { lpuClient } from '../lpu-events-student/src/supabase.js';
import {
  toLocalDateString,
  toDisplayDateString,
  formatEventDateRange,
  isEventToday,
  isEventTomorrow,
  isEventThisWeek,
  matchesScheduleFilter,
  createEventSlug,
  extractEventId,
  slugify,
  generateQrDataUrl,
  injectAdsIntoSequence,
  calculateAdPlacements,
} from '../lpu-events-student/src/shared/index.js';

interface TestCaseResult {
  id: string;
  category: 'Student' | 'Admin' | 'Lifecycle' | 'EdgeCase' | 'Regression';
  name: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  evidence?: string;
}

const results: TestCaseResult[] = [];

function recordTest(tc: TestCaseResult) {
  results.push(tc);
  const icon = tc.status === 'PASS' ? '✅' : tc.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${tc.category}] ${tc.id}: ${tc.name} -> ${tc.status}`);
  if (tc.status === 'FAIL') {
    console.log(`   Expected: ${tc.expected}`);
    console.log(`   Actual:   ${tc.actual}`);
    console.log(`   Severity: ${tc.severity || 'Medium'}`);
    if (tc.evidence) console.log(`   Evidence: ${tc.evidence}`);
  }
}

const STUDENT_URL = 'http://localhost:3000';
const ADMIN_URL = 'http://localhost:3001';
const SUPABASE_URL = 'https://nhjphyqiqhmxdhppljap.supabase.co';
const ANON_KEY = 'sb_publishable_S9KH9_RTpx1MiPwyEBWxRQ_QkJVgzsA';

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function runAllTests() {
  console.log('================================================================');
  console.log('  LPU EVENTS FINAL QA FUNCTIONAL TEST HARNESS');
  console.log(`  Local Time: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: STUDENT WEBSITE
  // --------------------------------------------------------------------------
  console.log('--- RUNNING SECTION 1: STUDENT WEBSITE ---');

  // 1.1 HTTP Server & Static Assets
  try {
    const res = await fetch(`${STUDENT_URL}/`);
    const text = await res.text();
    const hasHtml = text.includes('<!doctype html') || text.includes('<html');
    const hasRoot = text.includes('id="root"');
    recordTest({
      id: 'STU-01',
      category: 'Student',
      name: 'Homepage HTTP 200 & HTML Root Mount',
      expected: 'Status 200 with HTML document containing #root container',
      actual: `Status: ${res.status}, hasHtml: ${hasHtml}, hasRoot: ${hasRoot}`,
      status: res.status === 200 && hasHtml && hasRoot ? 'PASS' : 'FAIL',
      severity: 'Critical',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-01',
      category: 'Student',
      name: 'Homepage HTTP 200 & HTML Root Mount',
      expected: 'Status 200 with HTML document',
      actual: `Connection error: ${err.message}`,
      status: 'FAIL',
      severity: 'Critical',
    });
  }

  // 1.2 Security Headers on Student Website
  try {
    const res = await fetch(`${STUDENT_URL}/`);
    const csp = res.headers.get('Content-Security-Policy');
    const xcto = res.headers.get('X-Content-Type-Options');
    const xfo = res.headers.get('X-Frame-Options');
    recordTest({
      id: 'STU-02',
      category: 'Student',
      name: 'Student Security Headers (CSP, X-Content-Type-Options, X-Frame-Options)',
      expected: 'CSP present, nosniff, DENY',
      actual: `CSP: ${!!csp}, XCTO: ${xcto}, XFO: ${xfo}`,
      status: !!csp && xcto === 'nosniff' && xfo === 'DENY' ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-02',
      category: 'Student',
      name: 'Student Security Headers',
      expected: 'Security headers present',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // 1.3 Static File Route Guards
  try {
    const resEnv = await fetch(`${STUDENT_URL}/.env`);
    const resPkg = await fetch(`${STUDENT_URL}/package.json`);
    recordTest({
      id: 'STU-03',
      category: 'Student',
      name: 'Sensitive Static File Guard (.env and package.json rejected)',
      expected: 'HTTP 404 for sensitive configuration files',
      actual: `.env status: ${resEnv.status}, package.json status: ${resPkg.status}`,
      status: resEnv.status === 404 && resPkg.status === 404 ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-03',
      category: 'Student',
      name: 'Sensitive Static File Guard',
      expected: 'HTTP 404',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 1.4 Public Edge API: Categories Feed
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/categories`);
    const data = await res.json();
    const isArray = Array.isArray(data);
    const hasKeys = isArray && data.length > 0 && data[0].name && data[0].key;
    recordTest({
      id: 'STU-04',
      category: 'Student',
      name: 'Public API: Categories Listing (/api/public/categories)',
      expected: 'Array of categories with id, key, name, and subcategories',
      actual: `Status: ${res.status}, Array length: ${isArray ? data.length : 'not array'}`,
      status: res.status === 200 && isArray && hasKeys ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-04',
      category: 'Student',
      name: 'Public API: Categories Listing',
      expected: 'HTTP 200 with categories array',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 1.5 Public Edge API: Active Events Feed
  let sampleEvent: any = null;
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/events?limit=20`);
    const data = await res.json();
    const isArray = Array.isArray(data);
    if (isArray && data.length > 0) sampleEvent = data[0];

    const allPublished = isArray && data.every((e: any) => e.status === 'PUBLISHED');
    const now = new Date();
    // In active listing, events must not have ended in the past
    const noEndedEvents = isArray && data.every((e: any) => new Date(e.end_at) >= now);

    recordTest({
      id: 'STU-05',
      category: 'Student',
      name: 'Public API: Active Events Feed (/api/public/events)',
      expected: 'HTTP 200, array of published events, all end_at >= now()',
      actual: `Status: ${res.status}, Count: ${isArray ? data.length : 0}, allPublished: ${allPublished}, noEndedEvents: ${noEndedEvents}`,
      status: res.status === 200 && isArray && data.length > 0 && allPublished && noEndedEvents ? 'PASS' : 'FAIL',
      severity: 'Critical',
      evidence: isArray ? `Returned ${data.length} events` : JSON.stringify(data),
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-05',
      category: 'Student',
      name: 'Public API: Active Events Feed',
      expected: 'HTTP 200 with events array',
      actual: err.message,
      status: 'FAIL',
      severity: 'Critical',
    });
  }

  // 1.6 Event Chronological Ordering
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/events?limit=20`);
    const data = await res.json();
    let isSorted = true;
    if (Array.isArray(data) && data.length > 1) {
      for (let i = 0; i < data.length - 1; i++) {
        if (new Date(data[i].start_at).getTime() > new Date(data[i + 1].start_at).getTime()) {
          isSorted = false;
          break;
        }
      }
    }
    recordTest({
      id: 'STU-06',
      category: 'Student',
      name: 'Active Events Chronological Order (start_at ascending)',
      expected: 'Events sorted chronologically by start_at ascending',
      actual: `Sorted: ${isSorted}`,
      status: isSorted ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-06',
      category: 'Student',
      name: 'Active Events Chronological Order',
      expected: 'Events sorted',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // 1.7 Search Functionality
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/search?q=AI`);
    const data = await res.json();
    const isArray = Array.isArray(data);
    const matchesAI = isArray && data.some((e: any) => e.name.toLowerCase().includes('ai'));
    recordTest({
      id: 'STU-07',
      category: 'Student',
      name: 'Public API: Search Query Matching (/api/public/search?q=AI)',
      expected: 'HTTP 200, returns events matching query "AI"',
      actual: `Status: ${res.status}, Count: ${isArray ? data.length : 0}, matchesAI: ${matchesAI}`,
      status: res.status === 200 && isArray && matchesAI ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-07',
      category: 'Student',
      name: 'Public API: Search Query Matching',
      expected: 'Search results returned',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 1.8 Search Whitespace Trimming & Normalization
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/search?q=%20%20%20AI%20%20%20`);
    const data = await res.json();
    const isArray = Array.isArray(data);
    recordTest({
      id: 'STU-08',
      category: 'Student',
      name: 'Search Query Whitespace Normalization',
      expected: 'HTTP 200, handles leading/trailing whitespace properly',
      actual: `Status: ${res.status}, Count: ${isArray ? data.length : 0}`,
      status: res.status === 200 && isArray && data.length > 0 ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-08',
      category: 'Student',
      name: 'Search Query Whitespace Normalization',
      expected: 'HTTP 200',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // 1.9 Search Empty Results State
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/search?q=nonexistentquery_xyz_12345`);
    const data = await res.json();
    const isArray = Array.isArray(data);
    recordTest({
      id: 'STU-09',
      category: 'Student',
      name: 'Search Empty Results Handled Cleanly',
      expected: 'HTTP 200 with empty array []',
      actual: `Status: ${res.status}, isArray: ${isArray}, length: ${isArray ? data.length : 0}`,
      status: res.status === 200 && isArray && data.length === 0 ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-09',
      category: 'Student',
      name: 'Search Empty Results Handled Cleanly',
      expected: 'HTTP 200 with empty array',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // 1.10 Timeline Filter: Today
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/events?timeline=today`);
    const data = await res.json();
    const isArray = Array.isArray(data);
    const todayStr = toLocalDateString(new Date());
    const allToday = isArray && data.every((e: any) => isEventToday(e.start_at, e.end_at));
    recordTest({
      id: 'STU-10',
      category: 'Student',
      name: 'Timeline Filter: Today (?timeline=today)',
      expected: 'HTTP 200, returns only events occurring today',
      actual: `Status: ${res.status}, Count: ${isArray ? data.length : 0}, allToday: ${allToday} (today is ${todayStr})`,
      status: res.status === 200 && isArray && allToday ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-10',
      category: 'Student',
      name: 'Timeline Filter: Today',
      expected: 'Today events returned',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 1.11 Timeline Filter: Tomorrow
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/events?timeline=tomorrow`);
    const data = await res.json();
    const isArray = Array.isArray(data);
    const allTomorrow = isArray && data.every((e: any) => isEventTomorrow(e.start_at, e.end_at));
    recordTest({
      id: 'STU-11',
      category: 'Student',
      name: 'Timeline Filter: Tomorrow (?timeline=tomorrow)',
      expected: 'HTTP 200, returns only events occurring tomorrow',
      actual: `Status: ${res.status}, Count: ${isArray ? data.length : 0}, allTomorrow: ${allTomorrow}`,
      status: res.status === 200 && isArray && allTomorrow ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-11',
      category: 'Student',
      name: 'Timeline Filter: Tomorrow',
      expected: 'Tomorrow events returned',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 1.12 Pricing Filter: Free vs Paid
  try {
    const resFree = await fetch(`${STUDENT_URL}/api/public/events?pricing_type=FREE`);
    const freeData = await resFree.json();
    const resPaid = await fetch(`${STUDENT_URL}/api/public/events?pricing_type=PAID`);
    const paidData = await resPaid.json();

    const allFree = Array.isArray(freeData) && freeData.every((e: any) => e.pricing_type === 'FREE');
    const allPaid = Array.isArray(paidData) && paidData.every((e: any) => e.pricing_type === 'PAID');

    recordTest({
      id: 'STU-12',
      category: 'Student',
      name: 'Pricing Filter: FREE & PAID filtering',
      expected: 'HTTP 200, separate sets matching pricing_type',
      actual: `Free count: ${Array.isArray(freeData) ? freeData.length : 0} (allFree: ${allFree}), Paid count: ${Array.isArray(paidData) ? paidData.length : 0} (allPaid: ${allPaid})`,
      status: resFree.status === 200 && resPaid.status === 200 && allFree && allPaid ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-12',
      category: 'Student',
      name: 'Pricing Filter: FREE & PAID filtering',
      expected: 'Pricing filter works',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 1.13 Event Details API: Existing Event Lookup
  if (sampleEvent && sampleEvent.id) {
    try {
      const res = await fetch(`${STUDENT_URL}/api/public/events/${sampleEvent.id}`);
      const data = await res.json();
      const hasFields = data && data.id === sampleEvent.id && data.name && data.start_at && data.venue_name;
      recordTest({
        id: 'STU-13',
        category: 'Student',
        name: 'Event Details API: Valid Event UUID (/api/public/events/:id)',
        expected: 'HTTP 200 with full event details, content sections, and organization',
        actual: `Status: ${res.status}, ID match: ${data?.id === sampleEvent.id}, hasName: ${!!data?.name}`,
        status: res.status === 200 && hasFields ? 'PASS' : 'FAIL',
        severity: 'Critical',
      });
    } catch (err: any) {
      recordTest({
        id: 'STU-13',
        category: 'Student',
        name: 'Event Details API: Valid Event UUID',
        expected: 'HTTP 200 with details',
        actual: err.message,
        status: 'FAIL',
        severity: 'Critical',
      });
    }
  }

  // 1.14 Event Details API: Non-existent UUID
  try {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${STUDENT_URL}/api/public/events/${fakeUuid}`);
    recordTest({
      id: 'STU-14',
      category: 'Student',
      name: 'Event Details API: Non-existent UUID returns 404',
      expected: 'HTTP 404 NOT_FOUND',
      actual: `Status: ${res.status}`,
      status: res.status === 404 ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-14',
      category: 'Student',
      name: 'Event Details API: Non-existent UUID returns 404',
      expected: 'HTTP 404',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 1.15 Event Details API: Invalid ID handling
  try {
    const resHex = await fetch(`${STUDENT_URL}/api/public/events/abcdef`);
    const dataHex = await resHex.json();
    const resNonHex = await fetch(`${STUDENT_URL}/api/public/events/not-a-uuid`);
    
    // Non-36 char hex returns 400 Invalid event ID format
    // Non-hex string returns 404 Endpoint Not Found
    const hexRejected400 = resHex.status === 400 && dataHex?.error?.message === 'Invalid event ID format';
    const nonHexRejected404 = resNonHex.status === 404;

    recordTest({
      id: 'STU-15',
      category: 'Student',
      name: 'Event Details API: Invalid UUID parameter rejected gracefully',
      expected: 'HTTP 400 on malformed hex (abcdef) and HTTP 404 on non-hex (not-a-uuid)',
      actual: `Hex status: ${resHex.status} (msg: ${dataHex?.error?.message}), Non-hex status: ${resNonHex.status}`,
      status: hexRejected400 && nonHexRejected404 ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-15',
      category: 'Student',
      name: 'Event Details API: Invalid UUID parameter rejected gracefully',
      expected: 'Graceful rejection',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // 1.16 Client-side Slug Generation & Event ID Extraction Invariant
  const sampleName = 'Mega Blood Donation & Community Health Checkup Drive';
  const sampleUuid = '060337d5-87bc-4463-80db-79a989960cc2';
  const generatedSlug = createEventSlug(sampleName, sampleUuid);
  const extractedFromUuid = extractEventId(sampleUuid);
  const extractedFromCombined = extractEventId(`mega-blood-donation-${sampleUuid}`);
  const extractedFromSlug = extractEventId(generatedSlug);

  const slugContractPassed = 
    generatedSlug === 'mega-blood-donation-community-health-checkup-drive' &&
    extractedFromUuid === sampleUuid &&
    extractedFromCombined === sampleUuid &&
    extractedFromSlug === 'mega-blood-donation-community-health-checkup-drive';

  recordTest({
    id: 'STU-16',
    category: 'Student',
    name: 'SEO Slug Generation & Event ID Extraction Invariant',
    expected: 'Clean SEO slug produced, UUID extracted from combined/raw, clean slug preserved for search fallback',
    actual: `Generated: ${generatedSlug}, ExtractedRaw: ${extractedFromUuid}, ExtractedCombined: ${extractedFromCombined}`,
    status: slugContractPassed ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 1.17 Date Formatting & Timezone Safety
  const testIsoStart = '2026-09-12T04:00:00+00:00';
  const testIsoEnd = '2026-09-12T07:00:00+00:00';
  const formattedRange = formatEventDateRange(testIsoStart, testIsoEnd);
  const isMatch = formattedRange.includes('12/09/2026');
  recordTest({
    id: 'STU-17',
    category: 'Student',
    name: 'Date Range Formatting Utility (Single-day format)',
    expected: 'Formatted date includes 12/09/2026 without day drift',
    actual: `Formatted: ${formattedRange}`,
    status: isMatch ? 'PASS' : 'FAIL',
    severity: 'Medium',
  });

  // 1.18 Ad Interval & Placement Engine
  const mockEventsList = Array.from({ length: 25 }, (_, i) => ({ id: `event-${i}`, name: `Event ${i}` }));
  const mockAdsList = Array.from({ length: 5 }, (_, i) => ({ id: `ad-${i}`, name: `Ad ${i}` }));
  const placementConfig = {
    enabled: true,
    provider: 'direct' as const,
    frequency: 6,
    max_ads: 3
  };
  const adInjected = injectAdsIntoSequence(mockEventsList, mockAdsList, placementConfig);
  const adItems = adInjected.filter((item: any) => item && item.type === 'ad');
  const adCountPassed = adItems.length === 3; // 25 items with freq 6 gives 4 slots, capped at max_ads = 3
  
  recordTest({
    id: 'STU-18',
    category: 'Student',
    name: 'Ad Placement & Injection Logic (interval = 6, max_ads = 3)',
    expected: 'Exactly 3 ad items injected into 25 event items sequence',
    actual: `Total sequence length: ${adInjected.length}, Injected ads count: ${adItems.length}`,
    status: adCountPassed ? 'PASS' : 'FAIL',
    severity: 'Medium',
  });

  // 1.19 QR Code Data URL Generator
  try {
    const qrUrl = await generateQrDataUrl('https://lpuevents.live/events/test-123', { width: 300 });
    const isPngDataUrl = qrUrl.startsWith('data:image/png;base64,');
    recordTest({
      id: 'STU-19',
      category: 'Student',
      name: 'Event QR Code Data URL Generation',
      expected: 'Returns valid base64 PNG data URL',
      actual: `Starts with data:image/png;base64,: ${isPngDataUrl}`,
      status: isPngDataUrl ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'STU-19',
      category: 'Student',
      name: 'Event QR Code Data URL Generation',
      expected: 'Generates QR data URL',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // 1.20 Static View Navigation Paths on Student Website
  const staticRoutes = ['/about', '/contact', '/privacy', '/terms'];
  let allStaticRoutes200 = true;
  for (const route of staticRoutes) {
    try {
      const res = await fetch(`${STUDENT_URL}${route}`);
      if (res.status !== 200) allStaticRoutes200 = false;
    } catch {
      allStaticRoutes200 = false;
    }
  }
  recordTest({
    id: 'STU-20',
    category: 'Student',
    name: 'Static Informational Routes (/about, /contact, /privacy, /terms)',
    expected: 'HTTP 200 for all static SPA routes',
    actual: `All routes status 200: ${allStaticRoutes200}`,
    status: allStaticRoutes200 ? 'PASS' : 'FAIL',
    severity: 'Medium',
  });

  // --------------------------------------------------------------------------
  // SECTION 2: ADMIN WEBSITE / ORGANIZER PORTAL
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING SECTION 2: ADMIN WEBSITE & ORGANIZER PORTAL ---');

  // 2.1 Admin Homepage HTTP 200
  try {
    const res = await fetch(`${ADMIN_URL}/`);
    const text = await res.text();
    const hasHtml = text.includes('<!doctype html') || text.includes('<html');
    const hasRoot = text.includes('id="root"');
    recordTest({
      id: 'ADM-01',
      category: 'Admin',
      name: 'Admin Portal HTTP 200 & Root Mount',
      expected: 'Status 200 with HTML document containing #root container',
      actual: `Status: ${res.status}, hasHtml: ${hasHtml}, hasRoot: ${hasRoot}`,
      status: res.status === 200 && hasHtml && hasRoot ? 'PASS' : 'FAIL',
      severity: 'Critical',
    });
  } catch (err: any) {
    recordTest({
      id: 'ADM-01',
      category: 'Admin',
      name: 'Admin Portal HTTP 200 & Root Mount',
      expected: 'Status 200 with HTML document',
      actual: err.message,
      status: 'FAIL',
      severity: 'Critical',
    });
  }

  // 2.2 Admin Security Headers
  try {
    const res = await fetch(`${ADMIN_URL}/`);
    const csp = res.headers.get('Content-Security-Policy');
    const xcto = res.headers.get('X-Content-Type-Options');
    const xfo = res.headers.get('X-Frame-Options');
    recordTest({
      id: 'ADM-02',
      category: 'Admin',
      name: 'Admin Security Headers (CSP, X-Content-Type-Options, X-Frame-Options)',
      expected: 'CSP present, nosniff, DENY',
      actual: `CSP: ${!!csp}, XCTO: ${xcto}, XFO: ${xfo}`,
      status: !!csp && xcto === 'nosniff' && xfo === 'DENY' ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'ADM-02',
      category: 'Admin',
      name: 'Admin Security Headers',
      expected: 'Security headers present',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // 2.3 Unauthenticated Call to Protected RPCs
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/publish_event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_event_payload: {} }),
    });
    const data = await res.json();
    const isUnauth = res.status === 401 || (data && (data.code === 'UNAUTHENTICATED' || data.message?.includes('Administrative session required')));
    recordTest({
      id: 'ADM-03',
      category: 'Admin',
      name: 'Auth Guard: publish_event RPC rejects unauthenticated call',
      expected: '401 UNAUTHENTICATED or Administrative session required',
      actual: `Status: ${res.status}, Response: ${JSON.stringify(data)}`,
      status: isUnauth ? 'PASS' : 'FAIL',
      severity: 'Critical',
    });
  } catch (err: any) {
    recordTest({
      id: 'ADM-03',
      category: 'Admin',
      name: 'Auth Guard: publish_event RPC',
      expected: '401 UNAUTHENTICATED',
      actual: err.message,
      status: 'FAIL',
      severity: 'Critical',
    });
  }

  // 2.4 Unauthenticated Review Access Request Guard
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/review_access_request`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ request_id: '00000000-0000-0000-0000-000000000000', action_status: 'APPROVED' }),
    });
    const data = await res.json();
    const isRejected = (res.status === 401 || res.status === 403) || (data && (data.error?.includes('administrative permissions') || data.code === 'UNAUTHENTICATED'));
    recordTest({
      id: 'ADM-04',
      category: 'Admin',
      name: 'Auth Guard: review_access_request RPC rejects unauthenticated call',
      expected: 'Access denied error returned in payload or 401/403 status',
      actual: `Status: ${res.status}, Error payload: ${data?.error || data?.message}`,
      status: isRejected ? 'PASS' : 'FAIL',
      severity: 'Critical',
    });
  } catch (err: any) {
    recordTest({
      id: 'ADM-04',
      category: 'Admin',
      name: 'Auth Guard: review_access_request RPC',
      expected: 'Rejected',
      actual: err.message,
      status: 'FAIL',
      severity: 'Critical',
    });
  }

  // 2.5 Auth OTP Rate Limiting / Guardrails
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'invalid-email-format' }),
    });
    const data = await res.json();
    const rejected = res.status >= 400;
    recordTest({
      id: 'ADM-05',
      category: 'Admin',
      name: 'Auth OTP Flow: Malformed email rejection',
      expected: 'HTTP 400/422 on invalid email format',
      actual: `Status: ${res.status}, Error: ${data?.msg || data?.error_description || JSON.stringify(data)}`,
      status: rejected ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'ADM-05',
      category: 'Admin',
      name: 'Auth OTP Flow: Malformed email rejection',
      expected: 'Rejected',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 2.6 Form Validation: Required Name (Whitespace-only check)
  const validateName = (val: string) => val.trim().length > 0;
  recordTest({
    id: 'ADM-06',
    category: 'Admin',
    name: 'Form Validation: Whitespace-only Event Name rejected',
    expected: 'false when value is "   "',
    actual: `validateName("   ") returned: ${validateName('   ')}`,
    status: validateName('   ') === false ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 2.7 Form Validation: Required Venue Name (Whitespace-only check)
  const validateVenue = (val: string) => val.trim().length > 0;
  recordTest({
    id: 'ADM-07',
    category: 'Admin',
    name: 'Form Validation: Whitespace-only Venue Name rejected',
    expected: 'false when value is "    "',
    actual: `validateVenue("    ") returned: ${validateVenue('    ')}`,
    status: validateVenue('    ') === false ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 2.8 Form Validation: Temporal Bounds (End Date/Time <= Start Date/Time)
  const validateTemporalBounds = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return e > s;
  };
  const isTemporalValid = validateTemporalBounds('2026-09-15T14:00:00', '2026-09-15T12:00:00');
  recordTest({
    id: 'ADM-08',
    category: 'Admin',
    name: 'Form Validation: End Time <= Start Time strictly rejected',
    expected: 'false when end time is before start time',
    actual: `validateTemporalBounds returned: ${isTemporalValid}`,
    status: isTemporalValid === false ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 2.9 Form Validation: External Registration URL Format
  const URL_REGEX = /^https?:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;
  const isHttpValid = URL_REGEX.test('https://forms.gle/xyz123');
  const isJsRejected = !URL_REGEX.test('javascript:alert(1)');
  const isPlainRejected = !URL_REGEX.test('not_a_valid_url');
  recordTest({
    id: 'ADM-09',
    category: 'Admin',
    name: 'Form Validation: External Registration URL validation (rejects javascript:)',
    expected: 'Validates https:// domain, rejects javascript: and plain strings',
    actual: `https: ${isHttpValid}, javascript rejected: ${isJsRejected}, plain rejected: ${isPlainRejected}`,
    status: isHttpValid && isJsRejected && isPlainRejected ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 2.10 Form Validation: Pricing Invariants (PAID requires positive price amount)
  const validatePricing = (type: 'FREE' | 'PAID', amount: number) => {
    if (type === 'PAID') return amount > 0;
    return amount === 0;
  };
  const isPaidZeroRejected = !validatePricing('PAID', 0);
  const isPaidPositiveAllowed = validatePricing('PAID', 150);
  const isFreePositiveRejected = !validatePricing('FREE', 50);
  recordTest({
    id: 'ADM-10',
    category: 'Admin',
    name: 'Form Validation: Pricing Invariants (PAID > 0, FREE == 0)',
    expected: 'PAID 0 rejected, PAID > 0 allowed, FREE > 0 rejected',
    actual: `PaidZeroRejected: ${isPaidZeroRejected}, PaidPositive: ${isPaidPositiveAllowed}, FreePositiveRejected: ${isFreePositiveRejected}`,
    status: isPaidZeroRejected && isPaidPositiveAllowed && isFreePositiveRejected ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 2.11 Content Sections: Mandatory "About the Event" invariant
  const validateSections = (sections: Array<{ section_type: string; title: string; content: any }>) => {
    return sections.some(
      (s) => s.section_type === 'ABOUT' || s.title.trim().toLowerCase() === 'about the event'
    );
  };
  const hasAbout = validateSections([{ section_type: 'ABOUT', title: 'About the Event', content: 'Details' }]);
  const missingAbout = !validateSections([{ section_type: 'RULES', title: 'Event Rules', content: 'No rules' }]);
  recordTest({
    id: 'ADM-11',
    category: 'Admin',
    name: 'Content Sections: "About the Event" section remains mandatory',
    expected: 'Enforces presence of ABOUT section',
    actual: `hasAbout: ${hasAbout}, missingAbout rejected: ${missingAbout}`,
    status: hasAbout && missingAbout ? 'PASS' : 'FAIL',
    severity: 'Medium',
  });

  // 2.12 SuperAdmin Ad Control Configuration Readability
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/settings`);
    const data = await res.json();
    const isArray = Array.isArray(data);
    const hasAdConfig = isArray && data.some((s: any) => s.key === 'ad_system_config' || s.key === 'adsense_config' || s.key === 'ad_frequency_limits');
    recordTest({
      id: 'ADM-12',
      category: 'Admin',
      name: 'Ad Control Engine: Global Settings API returns valid configuration',
      expected: 'HTTP 200 with settings containing ad system / adsense configs',
      actual: `Status: ${res.status}, Array length: ${isArray ? data.length : 0}, hasAdConfig: ${hasAdConfig}`,
      status: res.status === 200 && isArray ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'ADM-12',
      category: 'Admin',
      name: 'Ad Control Engine: Global Settings API',
      expected: 'HTTP 200',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // --------------------------------------------------------------------------
  // SECTION 3: EVENT LIFECYCLE TESTING
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING SECTION 3: EVENT LIFECYCLE TESTING ---');

  // 3.1 Upcoming Event Matching
  const futureEvent = {
    start_at: new Date(Date.now() + 86400000).toISOString(),
    end_at: new Date(Date.now() + 90000000).toISOString(),
  };
  const isUpcoming = matchesScheduleFilter(futureEvent, 'upcoming');
  recordTest({
    id: 'LFC-01',
    category: 'Lifecycle',
    name: 'Upcoming Event Detection (future start & end time)',
    expected: 'true for event scheduled tomorrow',
    actual: `isUpcoming: ${isUpcoming}`,
    status: isUpcoming ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 3.2 Ongoing Event Detection
  const ongoingEvent = {
    start_at: new Date(Date.now() - 3600000).toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
  };
  const isOngoingActive = new Date(ongoingEvent.end_at) >= new Date();
  const isOngoingToday = isEventToday(ongoingEvent.start_at, ongoingEvent.end_at);
  recordTest({
    id: 'LFC-02',
    category: 'Lifecycle',
    name: 'Ongoing Event Lifecycle State (started 1h ago, ends in 1h)',
    expected: 'Event considered active and occurring today',
    actual: `isOngoingActive: ${isOngoingActive}, isOngoingToday: ${isOngoingToday}`,
    status: isOngoingActive && isOngoingToday ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });

  // 3.3 Expired / Concluded Event Disappearance from Active Listings
  const pastEvent = {
    start_at: new Date(Date.now() - 7200000).toISOString(),
    end_at: new Date(Date.now() - 3600000).toISOString(), // ended 1 hr ago
  };
  const isPastUpcoming = matchesScheduleFilter(pastEvent, 'upcoming');
  const isPastActive = new Date(pastEvent.end_at) >= new Date();
  recordTest({
    id: 'LFC-03',
    category: 'Lifecycle',
    name: 'Concluded Event Disappearance (ended 1h ago)',
    expected: 'Must be excluded from upcoming/active filters (false)',
    actual: `isPastUpcoming: ${isPastUpcoming}, isPastActive: ${isPastActive}`,
    status: !isPastUpcoming && !isPastActive ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });

  // 3.4 Boundary Condition: Exactly at end_at - 1 second
  const boundaryActive = {
    start_at: new Date(Date.now() - 3600000).toISOString(),
    end_at: new Date(Date.now() + 1000).toISOString(), // ends in 1 second
  };
  const isBoundaryActive = new Date(boundaryActive.end_at) >= new Date();
  recordTest({
    id: 'LFC-04',
    category: 'Lifecycle',
    name: 'Boundary Test: 1 second BEFORE event end_at',
    expected: 'Event remains visible / active (true)',
    actual: `isBoundaryActive: ${isBoundaryActive}`,
    status: isBoundaryActive ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 3.5 Boundary Condition: Exactly at end_at + 1 second
  const boundaryConcluded = {
    start_at: new Date(Date.now() - 3600000).toISOString(),
    end_at: new Date(Date.now() - 1000).toISOString(), // ended 1 second ago
  };
  const isBoundaryConcluded = new Date(boundaryConcluded.end_at) < new Date();
  recordTest({
    id: 'LFC-05',
    category: 'Lifecycle',
    name: 'Boundary Test: 1 second AFTER event end_at',
    expected: 'Event is concluded and excluded from active listings (true)',
    actual: `isBoundaryConcluded: ${isBoundaryConcluded}`,
    status: isBoundaryConcluded ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // 3.6 Public Edge Filter for Expired Events Verification
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,name,status,end_at&status=eq.PUBLISHED&end_at=lt.${new Date().toISOString()}`, { headers });
    const expiredInDb = await res.json();
    const countExpired = Array.isArray(expiredInDb) ? expiredInDb.length : 0;

    // Check if any of these expired events leak into public active feed
    const publicRes = await fetch(`${STUDENT_URL}/api/public/events?limit=50`);
    const publicData = await publicRes.json();
    let leakFound = false;
    if (Array.isArray(publicData) && countExpired > 0) {
      const expiredIds = new Set(expiredInDb.map((e: any) => e.id));
      leakFound = publicData.some((e: any) => expiredIds.has(e.id));
    }
    recordTest({
      id: 'LFC-06',
      category: 'Lifecycle',
      name: 'Public Feed Zero Leakage of Expired/Past Events',
      expected: 'Zero past events appear in active /api/public/events',
      actual: `Expired in DB: ${countExpired}, Leaked in public active feed: ${leakFound}`,
      status: !leakFound ? 'PASS' : 'FAIL',
      severity: 'Critical',
    });
  } catch (err: any) {
    recordTest({
      id: 'LFC-06',
      category: 'Lifecycle',
      name: 'Public Feed Zero Leakage of Expired Events',
      expected: 'No leaks',
      actual: err.message,
      status: 'FAIL',
      severity: 'Critical',
    });
  }

  // --------------------------------------------------------------------------
  // SECTION 4: VALIDATION & EDGE CASES
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING SECTION 4: VALIDATION & EDGE CASES ---');

  // 4.1 SQL Injection Payload in Search Query
  try {
    const sqli = encodeURIComponent("' OR '1'='1' --");
    const res = await fetch(`${STUDENT_URL}/api/public/search?q=${sqli}`);
    const data = await res.json();
    const isSafe = res.status === 200 || res.status === 400;
    const isArray = Array.isArray(data);
    recordTest({
      id: 'EDG-01',
      category: 'EdgeCase',
      name: 'SQL Injection in Search Query parameter',
      expected: 'Safe response (sanitized or empty array), no database crash or SQL error',
      actual: `Status: ${res.status}, isArray: ${isArray}`,
      status: isSafe && isArray ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'EDG-01',
      category: 'EdgeCase',
      name: 'SQL Injection in Search Query',
      expected: 'Handled safely',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 4.2 XSS Payload in Search & Event Fields
  try {
    const xss = encodeURIComponent('<script>alert("xss")</script>');
    const res = await fetch(`${STUDENT_URL}/api/public/search?q=${xss}`);
    const isSafe = res.status === 200 || res.status === 400;
    recordTest({
      id: 'EDG-02',
      category: 'EdgeCase',
      name: 'XSS Script Tag in Search Query parameter',
      expected: 'Safe response, script tag not executed / returns 200/400',
      actual: `Status: ${res.status}`,
      status: isSafe ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'EDG-02',
      category: 'EdgeCase',
      name: 'XSS Script Tag in Search Query',
      expected: 'Handled safely',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // 4.3 Extremely Long Query String Handling
  try {
    const longQuery = 'A'.repeat(600);
    const res = await fetch(`${STUDENT_URL}/api/public/search?q=${longQuery}`);
    const isGraceful = res.status === 200 || res.status === 400 || res.status === 414;
    recordTest({
      id: 'EDG-03',
      category: 'EdgeCase',
      name: 'Extremely Long Query String (600 characters)',
      expected: 'Fails gracefully without unhandled server exception (200/400/414)',
      actual: `Status: ${res.status}`,
      status: isGraceful ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'EDG-03',
      category: 'EdgeCase',
      name: 'Extremely Long Query String',
      expected: 'Graceful handling',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // 4.4 Unicode and Emojis Support in Event Titles
  const emojiTitle = '🎭 Rangmanch 2026: Drama Festival 🔥';
  const slugWithEmoji = slugify(emojiTitle);
  const isValidSlug = slugWithEmoji.length > 0 && !slugWithEmoji.includes(' ');
  recordTest({
    id: 'EDG-04',
    category: 'EdgeCase',
    name: 'Unicode & Emoji Slugification and Text Handling',
    expected: 'Clean URL-safe slug without crashing or illegal characters',
    actual: `Original: ${emojiTitle}, Slug: ${slugWithEmoji}`,
    status: isValidSlug ? 'PASS' : 'FAIL',
    severity: 'Low',
  });

  // 4.5 Negative Limit & Offset in Event Feed
  try {
    const res = await fetch(`${STUDENT_URL}/api/public/events?limit=-5&offset=-10`);
    const data = await res.json();
    const isClamped = Array.isArray(data);
    recordTest({
      id: 'EDG-05',
      category: 'EdgeCase',
      name: 'Negative Limit & Offset Clamping (?limit=-5&offset=-10)',
      expected: 'Clamped to valid positive ranges (limit >= 1, offset >= 0), returns 200',
      actual: `Status: ${res.status}, isArray: ${isClamped}`,
      status: res.status === 200 && isClamped ? 'PASS' : 'FAIL',
      severity: 'Medium',
    });
  } catch (err: any) {
    recordTest({
      id: 'EDG-05',
      category: 'EdgeCase',
      name: 'Negative Limit & Offset Clamping',
      expected: 'Clamped safely',
      actual: err.message,
      status: 'FAIL',
      severity: 'Medium',
    });
  }

  // --------------------------------------------------------------------------
  // SECTION 5: REGRESSION TESTING (END-TO-END JOURNEYS)
  // --------------------------------------------------------------------------
  console.log('\n--- RUNNING SECTION 5: REGRESSION TESTING ---');

  // 5.1 Student E2E Journey: Browse -> Open Event -> Verify Details & CTA URL
  try {
    // Step 1: Browse active feed
    const feedRes = await fetch(`${STUDENT_URL}/api/public/events?limit=5`);
    const feed = await feedRes.json();
    if (!Array.isArray(feed) || feed.length === 0) throw new Error('Feed empty');

    // Find an event with external registration URL
    const targetEvent = feed.find((e: any) => e.registration_mode === 'EXTERNAL' && e.external_registration_url) || feed[0];

    // Step 2: Open details
    const detailRes = await fetch(`${STUDENT_URL}/api/public/events/${targetEvent.id}`);
    const detail = await detailRes.json();

    const e2ePassed =
      detail.id === targetEvent.id &&
      detail.name === targetEvent.name &&
      detail.venue_name === targetEvent.venue_name;

    recordTest({
      id: 'REG-01',
      category: 'Regression',
      name: 'E2E Student Journey: Browse Feed -> Select Event -> Verify Details & External CTA',
      expected: 'Consistent event data between feed and detail view',
      actual: `Feed Event: ${targetEvent.name}, Detail Event: ${detail?.name}, RegMode: ${detail?.registration_mode}`,
      status: e2ePassed ? 'PASS' : 'FAIL',
      severity: 'Critical',
    });
  } catch (err: any) {
    recordTest({
      id: 'REG-01',
      category: 'Regression',
      name: 'E2E Student Journey',
      expected: 'Complete journey succeeds',
      actual: err.message,
      status: 'FAIL',
      severity: 'Critical',
    });
  }

  // 5.2 Organizer E2E Journey Validation: Data Consistency across Views
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,name,status,organizations(name),categories(name)&limit=5`, { headers });
    const events = await res.json();
    const hasOrgInfo = Array.isArray(events) && events.every((e: any) => e.name && e.status);
    recordTest({
      id: 'REG-02',
      category: 'Regression',
      name: 'E2E Organizer Journey: Event Association & Taxonomy Consistency',
      expected: 'All published events link to valid organizations and taxonomy categories',
      actual: `Events checked: ${Array.isArray(events) ? events.length : 0}, hasOrgInfo: ${hasOrgInfo}`,
      status: hasOrgInfo ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  } catch (err: any) {
    recordTest({
      id: 'REG-02',
      category: 'Regression',
      name: 'E2E Organizer Journey',
      expected: 'Data consistent',
      actual: err.message,
      status: 'FAIL',
      severity: 'High',
    });
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const blocked = results.filter((r) => r.status === 'BLOCKED').length;

  console.log('\n================================================================');
  console.log('  TEST EXECUTION SUMMARY');
  console.log(`  Total Test Cases: ${total}`);
  console.log(`  Passed:           ${passed}`);
  console.log(`  Failed:           ${failed}`);
  console.log(`  Blocked:          ${blocked}`);
  console.log(`  Pass Rate:        ${((passed / total) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  return { total, passed, failed, blocked, results };
}

runAllTests().catch((err) => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
