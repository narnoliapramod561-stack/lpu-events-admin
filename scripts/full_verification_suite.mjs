import fs from 'fs';

const SUPABASE_URL = 'https://nhjphyqiqhmxdhppljap.supabase.co';
const ANON_KEY = 'sb_publishable_S9KH9_RTpx1MiPwyEBWxRQ_QkJVgzsA';

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  Accept: 'application/json'
};

const results = {
  cacheInvalidation: null,
  databaseDirect: null,
  publicWorkerEvents: null,
  publicWorkerHomepage: null,
  publicWorkerFeatured: null,
  publicWorkerTrending: null,
  publicWorkerCarousel: null,
  eventDetail: null,
  searchRpc: null,
  categoriesDistribution: {},
  temporalDistribution: { today: 0, tomorrow: 0, dayAfter: 0 }
};

async function runVerification() {
  console.log('===========================================================');
  console.log('       LPU EVENTS — POST-RESET PRODUCTION VERIFICATION     ');
  console.log('===========================================================');

  // 1. Invalidate Edge Cache
  console.log('\n[1] Invalidating Cloudflare Edge Cache...');
  try {
    const invRes = await fetch('https://lpuevents.live/api/cache/invalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CACHE_ADMIN_ACCESS_TOKEN ? { 'Authorization': `Bearer ${process.env.CACHE_ADMIN_ACCESS_TOKEN}` } : {})
      },
      body: JSON.stringify({
        tags: ['events', 'homepage', 'featured', 'trending', 'carousel']
      })
    });
    const invData = await invRes.json();
    console.log(`Cache Invalidation Status: ${invRes.status}`, invData);
    results.cacheInvalidation = { status: invRes.status, data: invData };
  } catch (err) {
    console.error('Cache Invalidation Failed:', err.message);
    results.cacheInvalidation = { error: err.message };
  }

  // 2. Direct PostgREST Anonymous Query
  console.log('\n[2] Direct PostgREST Query (Anon / Public RLS)...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,name,start_at,end_at,status,venue_name,category_id,categories(name,key),subcategories(name,key),organizations(name)&order=start_at.asc`, { headers });
    const events = await res.json();
    console.log(`Total events returned: ${events.length}`);
    results.databaseDirect = { count: events.length, sample: events.slice(0, 3) };

    for (const e of events) {
      const catName = e.categories?.name || 'Uncategorized';
      results.categoriesDistribution[catName] = (results.categoriesDistribution[catName] || 0) + 1;
      if (e.start_at.startsWith('2026-09-07')) results.temporalDistribution.today++;
      else if (e.start_at.startsWith('2026-09-08')) results.temporalDistribution.tomorrow++;
      else if (e.start_at.startsWith('2026-09-09')) results.temporalDistribution.dayAfter++;
    }
    console.log('Temporal Distribution:', results.temporalDistribution);
    console.log('Category Distribution:', results.categoriesDistribution);
  } catch (err) {
    console.error('Database Direct Query Failed:', err.message);
  }

  // 3. Worker Public Events Endpoint
  console.log('\n[3] Testing Worker Public Events API (https://lpuevents.live/api/public/events?page=1)...');
  try {
    const res = await fetch('https://lpuevents.live/api/public/events?page=1', {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    console.log(`Worker Events API Status: ${res.status}`);
    console.log(`Payload Type:`, Array.isArray(data) ? `Array of ${data.length}` : (data.events ? `Object with ${data.events.length} events (Total: ${data.total})` : typeof data));
    results.publicWorkerEvents = { status: res.status, count: Array.isArray(data) ? data.length : (data.events?.length || data.data?.length || 0), dataSample: Array.isArray(data) ? data[0] : (data.events?.[0] || data) };
  } catch (err) {
    console.error('Worker Events API Failed:', err.message);
  }

  // 4. Worker Public Homepage Endpoint
  console.log('\n[4] Testing Worker Public Homepage API (https://lpuevents.live/api/public/homepage)...');
  try {
    const res = await fetch('https://lpuevents.live/api/public/homepage', {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    console.log(`Worker Homepage API Status: ${res.status}`);
    console.log('Homepage Keys:', Object.keys(data));
    if (data.featured) console.log(`Featured Count: ${data.featured.length}`);
    if (data.trending) console.log(`Trending Count: ${data.trending.length}`);
    if (data.carousel) console.log(`Carousel Count: ${data.carousel.length}`);
    results.publicWorkerHomepage = {
      status: res.status,
      keys: Object.keys(data),
      featuredCount: data.featured?.length || 0,
      trendingCount: data.trending?.length || 0,
      carouselCount: data.carousel?.length || 0
    };
  } catch (err) {
    console.error('Worker Homepage API Failed:', err.message);
  }

  // 5. Test RPC search_events
  console.log('\n[5] Testing RPC search_events...');
  try {
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_events`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_query: 'AI', p_limit: 5, p_offset: 0 })
    });
    const rpcData = await rpcRes.json();
    console.log(`search_events RPC Status: ${rpcRes.status}, returned: ${Array.isArray(rpcData) ? rpcData.length : 'ERROR'}`);
    results.searchRpc = { status: rpcRes.status, count: Array.isArray(rpcData) ? rpcData.length : 0 };
  } catch (err) {
    console.error('search_events RPC Failed:', err.message);
  }

  // 6. Test Single Event Detail with Sections
  console.log('\n[6] Testing Event Content Sections...');
  try {
    const secRes = await fetch(`${SUPABASE_URL}/rest/v1/event_content_sections?select=id,event_id,section_type,title,content&order=sort_order.asc&limit=6`, { headers });
    const secData = await secRes.json();
    console.log(`Content Sections count returned: ${secData.length}`);
    results.eventDetail = { count: secData.length, sample: secData[0] };
  } catch (err) {
    console.error('Event Content Sections Failed:', err.message);
  }

  fs.writeFileSync('scripts/verification_results.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Verification Complete! Summary written to scripts/verification_results.json');
}

runVerification();
