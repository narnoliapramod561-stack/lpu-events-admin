const fs = require('fs');
const path = require('path');

const dataRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'subcategories.json'), 'utf8'));
const subcategories = dataRaw.rows[0].json_agg;

const organizations = [
  '11111111-1111-1111-1111-111111111111', // Coding & Robotics Club LPU
  '22222222-2222-2222-2222-222222222222', // Cultural & Youth Welfare Society
  '33333333-3333-3333-3333-333333333333', // LPU Sports Authority & Esports Cell
  '44444444-4444-4444-4444-444444444444', // Google Developer Student Club LPU
  '55555555-5555-5555-5555-555555555555', // Society of Fine Arts & Design LPU
  '66666666-6666-6666-6666-666666666666', // Literary & Debating Society LPU
  '77777777-7777-7777-7777-777777777777'  // Mittal School of Business E-Cell
];

const venues = [
  'Shanti Devi Mittal Auditorium, Block 32',
  'Baldev Raj Mittal Unipolis',
  'DSW Conference Hall, Block 13',
  'Innovation Studio, Block 38',
  'CSE Expo Arena, Block 34',
  'Mittal School of Business Auditorium, Block 14',
  'Indoor Sports Complex Arena, Block 29',
  'School of Architecture & Design, Block 26',
  'Uni-Hospital Complex & DSW Reception',
  'Parade Ground, Gate 1',
  'Central Lawns & Unipolis Corridor',
  'Agriculture Demonstration Field, Block 41',
  'BioTech Complex, Block 28'
];

const adminUserId = 'ad19edc7-6f1f-4b7a-97f6-6e9c1b8f55fc';

function sqlEscape(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

let sql = `BEGIN;\nDELETE FROM public.featured_events;\nDELETE FROM public.trending_events;\nDELETE FROM public.carousel_items;\nDELETE FROM public.event_memory_media;\nDELETE FROM public.event_memories;\nDELETE FROM public.sponsors;\nDELETE FROM public.event_content_sections;\nDELETE FROM public.events;\n\nINSERT INTO public.events (\n  id, organization_id, created_by, updated_by, name, description,\n  category_id, subcategory_id, banner_media_id, start_at, end_at,\n  venue_name, registration_mode, external_registration_url, registration_opens_at,\n  registration_closes_at, pricing_type, registration_format, capacity_limit,\n  capacity_counts_by, team_pricing_mode, price_amount, status, view_count\n) VALUES\n`;

const valuesList = [];

subcategories.forEach((sub, idx) => {
  const orgId = organizations[idx % organizations.length];
  const venueToday = venues[idx % venues.length];
  const venueTomorrow = venues[(idx + 1) % venues.length];

  const catName = sub.category_name;
  const subName = sub.subcategory_name;

  // 1. Today event (2026-09-02)
  const todayStartHour = 9 + (idx % 4); // 9:00, 10:00, 11:00, 12:00
  const todayEndHour = todayStartHour + 3 + (idx % 3); // 3-5 hours duration
  const startAtToday = `2026-09-02 ${String(todayStartHour).padStart(2, '0')}:00:00+05:30`;
  const endAtToday = `2026-09-02 ${String(todayEndHour).padStart(2, '0')}:30:00+05:30`;

  const eventNameToday = `${catName} — ${subName}: Live Session 2026`;
  const descToday = `Engaging campus program hosted under ${catName} focusing on ${subName}. Open to all university students for interactive learning, live demonstrations, and networking.`;

  valuesList.push(`(
    gen_random_uuid(),
    '${orgId}',
    '${adminUserId}',
    '${adminUserId}',
    ${sqlEscape(eventNameToday)},
    ${sqlEscape(descToday)},
    '${sub.category_id}',
    '${sub.subcategory_id}',
    NULL,
    '${startAtToday}',
    '${endAtToday}',
    ${sqlEscape(venueToday)},
    'EXTERNAL',
    'https://lpuevents.live/register',
    '2026-08-20 00:00:00+05:30',
    '2026-09-02 08:30:00+05:30',
    'FREE',
    'INDIVIDUAL',
    200,
    NULL,
    NULL,
    0,
    'PUBLISHED',
    ${20 + (idx % 50)}
  )`);

  // 2. Tomorrow event (2026-09-03)
  const tomStartHour = 10 + (idx % 4);
  const tomEndHour = tomStartHour + 3 + (idx % 3);
  const startAtTomorrow = `2026-09-03 ${String(tomStartHour).padStart(2, '0')}:00:00+05:30`;
  const endAtTomorrow = `2026-09-03 ${String(tomEndHour).padStart(2, '0')}:30:00+05:30`;

  const eventNameTomorrow = `${catName} — ${subName}: Grand Conclave 2026`;
  const descTomorrow = `Exclusive university session organized for ${subName} under ${catName}. Experience keynote panels, hands-on workshops, and expert discussions.`;

  valuesList.push(`(
    gen_random_uuid(),
    '${orgId}',
    '${adminUserId}',
    '${adminUserId}',
    ${sqlEscape(eventNameTomorrow)},
    ${sqlEscape(descTomorrow)},
    '${sub.category_id}',
    '${sub.subcategory_id}',
    NULL,
    '${startAtTomorrow}',
    '${endAtTomorrow}',
    ${sqlEscape(venueTomorrow)},
    'EXTERNAL',
    'https://lpuevents.live/register',
    '2026-08-20 00:00:00+05:30',
    '2026-09-03 09:30:00+05:30',
    'FREE',
    'INDIVIDUAL',
    250,
    NULL,
    NULL,
    0,
    'PUBLISHED',
    ${15 + (idx % 40)}
  )`);
});

sql += valuesList.join(',\n') + ';\nCOMMIT;\n';

fs.writeFileSync(path.join(__dirname, 'seed_all_subcategories.sql'), sql, 'utf8');
console.log(`Generated SQL for ${subcategories.length * 2} events across ${subcategories.length} subcategories.`);
