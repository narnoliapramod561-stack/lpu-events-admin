import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://nhjphyqiqhmxdhppljap.supabase.co';
const ANON_KEY = 'sb_publishable_S9KH9_RTpx1MiPwyEBWxRQ_QkJVgzsA';

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  Accept: 'application/json'
};

function sqlStr(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function sqlJsonb(obj) {
  if (obj === null || obj === undefined) return 'NULL';
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

async function run() {
  console.log('Fetching live categories, subcategories, organizations, media...');
  
  const [catsRes, subsRes, orgsRes, mediaRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/categories?select=id,key,name&is_active=eq.true&order=sort_order.asc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/subcategories?select=id,category_id,key,name&is_active=eq.true&order=sort_order.asc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/organizations?select=id,name&is_active=eq.true`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/media_assets?select=id,object_key&status=eq.READY&limit=30`, { headers })
  ]);

  const categories = await catsRes.json();
  const subcategories = await subsRes.json();
  const organizations = await orgsRes.json();
  const mediaAssets = await mediaRes.json();

  const creatorId = '0f159cb9-b672-499d-a9b6-d61d370342a5';

  const catMap = {};
  for (const c of categories) catMap[c.key] = c;

  const subsByCat = {};
  for (const s of subcategories) {
    if (!subsByCat[s.category_id]) subsByCat[s.category_id] = {};
    subsByCat[s.category_id][s.key] = s;
  }

  // 10 Events for TODAY (2026-09-12, Saturday)
  const todayEvents = [
    {
      name: "National AI & Large Language Models Symposium 2026",
      catKey: "academics",
      subKey: "seminar",
      venue: "Shanti Devi Mittal Auditorium, Block 32",
      start: "2026-09-12 09:30:00+05:30",
      end: "2026-09-12 12:30:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 450,
      desc: "Explore cutting-edge developments in Artificial Intelligence, Large Language Models, and Scalable Data Engineering with leading researchers and industry experts."
    },
    {
      name: "Quantum Computing & Post-Quantum Cryptography Workshop",
      catKey: "academics",
      subKey: "workshop",
      venue: "Block 34, Auditorium Hall 102",
      start: "2026-09-12 10:00:00+05:30",
      end: "2026-09-12 13:30:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 300,
      desc: "A hands-on deep dive into quantum algorithms, qubit simulation architectures, and post-quantum cryptographic protocols."
    },
    {
      name: "LPU HackNext 2026: 24-Hour Smart Campus Hackathon",
      catKey: "innovation",
      subKey: "hackathon",
      venue: "Innovation Studio, Block 38",
      start: "2026-09-12 10:30:00+05:30",
      end: "2026-09-12 20:00:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "TEAM",
      cap: 250,
      desc: "Build transformative software and IoT hardware solutions tackling campus sustainability, digital health, and smart mobility."
    },
    {
      name: "Mega Blood Donation & Community Health Checkup Drive",
      catKey: "community-services",
      subKey: "healthcare",
      venue: "Uni-Hospital Medical Center Lawn",
      start: "2026-09-12 09:00:00+05:30",
      end: "2026-09-12 14:00:00+05:30",
      regMode: "NONE",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 1000,
      desc: "Join hands with the Red Cross and student volunteers to donate blood and receive comprehensive health checks."
    },
    {
      name: "Campus Pitch Tank: Seed Stage Startup Pitching",
      catKey: "entrepreneurship",
      subKey: "pitch-fest",
      venue: "Startup Incubation Center, Block 30",
      start: "2026-09-12 11:30:00+05:30",
      end: "2026-09-12 15:30:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "TEAM",
      cap: 200,
      desc: "Student founders pitch innovative business prototypes to leading venture capitalists and angel investors for seed funding."
    },
    {
      name: "Full-Stack Cloud Architecture & Edge AI Masterclass",
      catKey: "co-curricular",
      subKey: "skill-dev",
      venue: "Block 38, Computer Lab 4",
      start: "2026-09-12 13:00:00+05:30",
      end: "2026-09-12 16:30:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 120,
      desc: "Build resilient, distributed microservices using modern serverless platforms, edge compute, and high-performance databases."
    },
    {
      name: "Nritya: Pan-India Classical & Folk Dance Championship",
      catKey: "cultural",
      subKey: "dance",
      venue: "Shanti Devi Mittal Auditorium",
      start: "2026-09-12 14:00:00+05:30",
      end: "2026-09-12 18:00:00+05:30",
      regMode: "NONE",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 800,
      desc: "A vibrant cultural showcase of classical Bharatanatyam, Kathak, Bhangra, and regional folk dances from across India."
    },
    {
      name: "CyberSecurity Capture The Flag (CTF) Arena",
      catKey: "student-clubs",
      subKey: "tech-clubs",
      venue: "Cyber Forensics Lab, Block 38",
      start: "2026-09-12 14:30:00+05:30",
      end: "2026-09-12 18:30:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "TEAM",
      cap: 180,
      desc: "Test your skills in binary exploitation, reverse engineering, web application vulnerabilities, and cryptography."
    },
    {
      name: "Rashtriya Ekta: Youth Leadership & Unity Convention",
      catKey: "day-celebrations",
      subKey: "national-days",
      venue: "Baldev Raj Mittal Hall 3",
      start: "2026-09-12 15:00:00+05:30",
      end: "2026-09-12 18:00:00+05:30",
      regMode: "NONE",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 600,
      desc: "A patriotic youth convention celebrating national integration, youth leadership, and nation-building initiatives."
    },
    {
      name: "Dhwani 2026: Inter-University Classical & Folk Fusion Night",
      catKey: "cultural",
      subKey: "music",
      venue: "Baldev Raj Mittal Unipolis",
      start: "2026-09-12 17:30:00+05:30",
      end: "2026-09-12 21:30:00+05:30",
      regMode: "NONE",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 3000,
      desc: "An electric musical celebration bringing together traditional Indian classical instruments with contemporary acoustic arrangements."
    }
  ];

  // 10 Events for TOMORROW (2026-09-13, Sunday)
  const tomorrowEvents = [
    {
      name: "Clean Green Campus: Eco-Pledge & Tree Plantation Drive",
      catKey: "community-services",
      subKey: "environment",
      venue: "Botanical Garden, North Campus",
      start: "2026-09-13 08:30:00+05:30",
      end: "2026-09-13 12:00:00+05:30",
      regMode: "NONE",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 500,
      desc: "Plant native fruit and shade trees across the north campus corridor and pledge towards a carbon-neutral university."
    },
    {
      name: "Future of Semiconductor Fabrication & Sub-3nm Architecture",
      catKey: "academics",
      subKey: "guest-lecture",
      venue: "Block 36, EEE Seminar Hall",
      start: "2026-09-13 10:00:00+05:30",
      end: "2026-09-13 13:00:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 180,
      desc: "An executive technical lecture on sub-3nm chip fabrication, extreme ultraviolet lithography, and RISC-V acceleration."
    },
    {
      name: "Venture Quest: Inter-College B-Plan Championship",
      catKey: "entrepreneurship",
      subKey: "b-plan",
      venue: "Mittal School of Business Auditorium",
      start: "2026-09-13 10:00:00+05:30",
      end: "2026-09-13 14:30:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "TEAM",
      cap: 250,
      desc: "Inter-college business plan competition evaluating market feasibility, financial models, and go-to-market strategies."
    },
    {
      name: "Robotics & Edge AI Autonomous Systems Expo",
      catKey: "innovation",
      subKey: "technical-events",
      venue: "Robotics Innovation Lab, Block 28",
      start: "2026-09-13 10:30:00+05:30",
      end: "2026-09-13 16:00:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "TEAM",
      cap: 250,
      desc: "Live demonstrations of autonomous rovers, agricultural drone swarms, and computer vision robotic arms."
    },
    {
      name: "Global Tech Internship & Career Acceleration Summit",
      catKey: "academics",
      subKey: "internship",
      venue: "Block 32, Main Auditorium",
      start: "2026-09-13 11:00:00+05:30",
      end: "2026-09-13 15:00:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 500,
      desc: "Connect directly with top tier tech recruiters, engineering managers, and alumni for summer 2027 internship placements."
    },
    {
      name: "National Parliamentary Debate League 2026",
      catKey: "co-curricular",
      subKey: "competitions",
      venue: "Law Auditorium, Block 14",
      start: "2026-09-13 11:30:00+05:30",
      end: "2026-09-13 16:00:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "TEAM",
      cap: 150,
      desc: "Top debaters clash on global geopolitics, economic policy, and technology governance under Asian Parliamentary rules."
    },
    {
      name: "Digital Creators & Campus Influencers Conclave",
      catKey: "cultural",
      subKey: "social-media",
      venue: "Design Studio 204, Block 27",
      start: "2026-09-13 13:30:00+05:30",
      end: "2026-09-13 17:00:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 220,
      desc: "Learn viral storytelling, short-form video cinematography, monetization, and personal branding from top digital creators."
    },
    {
      name: "Competitive Programming Arena: Fall Cup 2026",
      catKey: "student-clubs",
      subKey: "tech-clubs",
      venue: "Block 38, Lab 1 & 2",
      start: "2026-09-13 14:00:00+05:30",
      end: "2026-09-13 17:30:00+05:30",
      regMode: "EXTERNAL",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 160,
      desc: "Fast-paced algorithmic contest testing dynamic programming, graph theory, geometry, and number theory under time constraints."
    },
    {
      name: "Virasat: Pan-India Heritage & Folk Arts Carnival",
      catKey: "day-celebrations",
      subKey: "cultural-days",
      venue: "Baldev Raj Mittal Unipolis Arena",
      start: "2026-09-13 15:00:00+05:30",
      end: "2026-09-13 20:00:00+05:30",
      regMode: "NONE",
      priceType: "FREE",
      format: "INDIVIDUAL",
      cap: 2500,
      desc: "A massive cultural carnival featuring regional artisan stalls, traditional folk music, live pottery, and regional cuisines."
    },
    {
      name: "Rangmanch 2026: Annual Street Play & Drama Festival",
      catKey: "cultural",
      subKey: "theatre",
      venue: "Open Air Theatre, Unipolis",
      start: "2026-09-13 16:30:00+05:30",
      end: "2026-09-13 20:30:00+05:30",
      regMode: "NONE",
      priceType: "FREE",
      format: "TEAM",
      cap: 1500,
      desc: "Top campus theatre troupes bring gripping street plays (Nukkad Natak), musical stage plays, and social satire to life."
    }
  ];

  const allEvents = [...todayEvents, ...tomorrowEvents];

  let sql = `-- Seed 10 Events for Today (2026-09-12) and 10 Events for Tomorrow (2026-09-13)
BEGIN;

-- Clean existing events
DELETE FROM public.event_content_sections;
DELETE FROM public.featured_events;
DELETE FROM public.trending_events;
DELETE FROM public.carousel_items WHERE event_id IS NOT NULL;
DELETE FROM public.events;

`;

  for (let i = 0; i < allEvents.length; i++) {
    const item = allEvents[i];
    const eventId = `e${String(i + 1).padStart(7, '0')}-0000-0000-0000-000000000000`;
    const cat = catMap[item.catKey] || categories[0];
    const sub = (subsByCat[cat.id] && subsByCat[cat.id][item.subKey]) || null;
    const org = organizations[i % organizations.length];
    const media = mediaAssets[i % mediaAssets.length]?.id || null;

    const regUrl = item.regMode === 'EXTERNAL' ? `https://lpuevents.live/register/${encodeURIComponent(item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}` : null;
    const viewCount = Math.floor(Math.random() * 250) + 40;

    sql += `
INSERT INTO public.events (
  id, organization_id, created_by, updated_by, name, description,
  category_id, subcategory_id, banner_media_id, start_at, end_at,
  venue_name, registration_mode, external_registration_url, pricing_type,
  registration_format, capacity_limit, price_amount, status, view_count,
  created_at, updated_at
) VALUES (
  '${eventId}',
  '${org.id}',
  '${creatorId}',
  '${creatorId}',
  ${sqlStr(item.name)},
  ${sqlStr(item.desc)},
  '${cat.id}',
  ${sub ? `'${sub.id}'` : 'NULL'},
  NULL,
  '${item.start}',
  '${item.end}',
  ${sqlStr(item.venue)},
  '${item.regMode}',
  ${sqlStr(regUrl)},
  '${item.priceType}',
  '${item.format}',
  ${item.cap},
  0,
  'PUBLISHED',
  ${viewCount},
  now(),
  now()
);

-- Content sections
INSERT INTO public.event_content_sections (id, event_id, section_type, title, content, sort_order, created_at, updated_at)
VALUES
(
  gen_random_uuid(),
  '${eventId}',
  'TEXT',
  'Event Overview',
  ${sqlJsonb({ text: item.desc + " Organized in partnership with top university societies and external industry leaders." })},
  1,
  now(),
  now()
),
(
  gen_random_uuid(),
  '${eventId}',
  'SCHEDULE',
  'Event Timeline',
  ${sqlJsonb({
    items: [
      { time: item.start.split(' ')[1].slice(0, 5), title: 'Registration & Check-In', description: 'Attendees arrive and complete badge scanning at the venue entrance.' },
      { time: '11:00', title: 'Keynote & Main Activities', description: 'Main stage presentations, sessions, and live showcases.' },
      { time: item.end.split(' ')[1].slice(0, 5), title: 'Valedictory & Conclusion', description: 'Closing remarks and certificate distribution.' }
    ]
  })},
  2,
  now(),
  now()
),
(
  gen_random_uuid(),
  '${eventId}',
  'FAQ',
  'Important Guidelines',
  ${sqlJsonb({
    faqs: [
      { question: 'Who is eligible to participate?', answer: 'All registered students of Lovely Professional University with a valid student ID card.' },
      { question: 'Is prior registration mandatory?', answer: item.regMode === 'EXTERNAL' ? 'Yes, please complete registration through the provided external registration link.' : 'No prior registration required, walk-ins are welcomed on a first-come, first-served basis up to venue capacity.' },
      { question: 'Will certificates of participation be provided?', answer: 'Yes, verified e-certificates will be issued to all checked-in attendees.' }
    ]
  })},
  3,
  now(),
  now()
);
`;
  }

  // Add featured and trending events
  sql += `
-- Featured events (first 3 today + first 2 tomorrow)
INSERT INTO public.featured_events (event_id, sort_order, created_by, created_at, updated_at)
VALUES
  ('e0000001-0000-0000-0000-000000000000', 1, '${creatorId}', now(), now()),
  ('e0000003-0000-0000-0000-000000000000', 2, '${creatorId}', now(), now()),
  ('e0000004-0000-0000-0000-000000000000', 3, '${creatorId}', now(), now()),
  ('e0000011-0000-0000-0000-000000000000', 4, '${creatorId}', now(), now()),
  ('e0000014-0000-0000-0000-000000000000', 5, '${creatorId}', now(), now());

-- Trending events
INSERT INTO public.trending_events (event_id, sort_order, created_by, created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000000', 1, '${creatorId}', now(), now()),
  ('e0000001-0000-0000-0000-000000000000', 2, '${creatorId}', now(), now()),
  ('e0000005-0000-0000-0000-000000000000', 3, '${creatorId}', now(), now()),
  ('e0000014-0000-0000-0000-000000000000', 4, '${creatorId}', now(), now()),
  ('e0000020-0000-0000-0000-000000000000', 5, '${creatorId}', now(), now());

COMMIT;
`;

  const outputPath = path.join(__dirname, '../supabase/seed_20_today_tomorrow.sql');
  fs.writeFileSync(outputPath, sql);
  console.log(`Generated SQL at ${outputPath}`);
}

run();
