
const SUPABASE_URL = 'https://nhjphyqiqhmxdhppljap.supabase.co';
const ANON_KEY = 'sb_publishable_S9KH9_RTpx1MiPwyEBWxRQ_QkJVgzsA';

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  Accept: 'application/json'
};

async function check() {
  console.log('--- Verifying Database State via PostgREST ---');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,name,start_at,end_at,status,venue_name,category_id,categories(name,key),subcategories(name,key)&order=start_at.asc`, { headers });
    const events = await res.json();
    console.log(`Total Events returned by PostgREST (anon): ${Array.isArray(events) ? events.length : 'ERROR'}`);
    if (Array.isArray(events) && events.length > 0) {
      console.log(`First event: ${events[0].name} (${events[0].start_at} to ${events[0].end_at})`);
      console.log(`Last event: ${events[events.length - 1].name} (${events[events.length - 1].start_at} to ${events[events.length - 1].end_at})`);

      // Count by day
      const today = events.filter(e => e.start_at.startsWith('2026-09-07')).length;
      const tomorrow = events.filter(e => e.start_at.startsWith('2026-09-08')).length;
      const dayAfter = events.filter(e => e.start_at.startsWith('2026-09-09')).length;
      console.log(`Distribution: Today (Sept 7): ${today}, Tomorrow (Sept 8): ${tomorrow}, Day After (Sept 9): ${dayAfter}`);
    } else {
      console.log('Result:', events);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
