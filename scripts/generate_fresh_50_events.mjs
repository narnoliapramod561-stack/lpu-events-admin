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

const eventTemplates = [
  // Academics & Technical (8)
  { name: "National AI & Large Language Models Symposium 2026", catKey: "academics", mode: "EXTERNAL", price: "FREE", venue: "Shanti Devi Mittal Auditorium, Block 32", format: "INDIVIDUAL", cap: 450, desc: "Explore cutting-edge developments in Artificial Intelligence, Large Language Models, and Scalable Data Engineering with leading researchers and industry experts." },
  { name: "Quantum Computing & Cryptography Workshop", catKey: "academics", mode: "EXTERNAL", price: "FREE", venue: "Block 34, Auditorium Hall 102", format: "INDIVIDUAL", cap: 300, desc: "A hands-on deep dive into quantum algorithms, qubit simulation architectures, and post-quantum cryptographic protocols." },
  { name: "Full-Stack Cloud Architecture Masterclass", catKey: "academics", mode: "EXTERNAL", price: "FREE", venue: "Block 38, Computer Lab 4", format: "INDIVIDUAL", cap: 120, desc: "Build resilient, distributed microservices using modern serverless platforms, edge compute, and high-performance databases." },
  { name: "Robotics & Edge AI Autonomous Systems Expo", catKey: "innovation", mode: "EXTERNAL", price: "FREE", venue: "Robotics Innovation Lab, Block 28", format: "TEAM", cap: 250, desc: "Showcasing student-built autonomous rovers, drone swarms, and computer vision powered robotic arms." },
  { name: "Next-Gen Web3 & Decentralized Systems Colloquium", catKey: "academics", mode: "EXTERNAL", price: "FREE", venue: "Auditorium 2, Block 33", format: "INDIVIDUAL", cap: 200, desc: "Learn the fundamentals of smart contract security, zero-knowledge proofs, and decentralized consensus mechanisms." },
  { name: "Biomedical Engineering & Neural Interfaces Seminar", catKey: "academics", mode: "EXTERNAL", price: "FREE", venue: "Medical Sciences Hall 105", format: "INDIVIDUAL", cap: 180, desc: "Investigating next-generation brain-computer interfaces, bio-signal processing, and AI in diagnostic healthcare." },
  { name: "VLSI Design & Semiconductor Fabrication Seminar", catKey: "academics", mode: "EXTERNAL", price: "FREE", venue: "Block 36, EEE Seminar Hall", format: "INDIVIDUAL", cap: 150, desc: "An executive technical seminar on sub-5nm chip fabrication, RISC-V architectures, and FPGA hardware acceleration." },
  { name: "Data Science & Predictive Analytics Summit", catKey: "academics", mode: "EXTERNAL", price: "FREE", venue: "Block 34, Main Seminar Hall", format: "INDIVIDUAL", cap: 350, desc: "Master big data pipelines, machine learning feature stores, and real-time streaming analytics in modern enterprise." },

  // Cultural & Arts (6)
  { name: "Dhwani 2026: Inter-University Fusion Music Night", catKey: "cultural", mode: "NONE", price: "FREE", venue: "Baldev Raj Mittal Unipolis", format: "INDIVIDUAL", cap: 3000, desc: "An electric musical celebration uniting traditional Indian classical ragas with contemporary acoustic arrangements." },
  { name: "Nritya: Pan-India Classical & Folk Dance Showcase", catKey: "cultural", mode: "NONE", price: "FREE", venue: "Shanti Devi Mittal Auditorium", format: "INDIVIDUAL", cap: 800, desc: "A vibrant cultural showcase of classical Bharatanatyam, Kathak, Bhangra, and regional folk dances from across 28 states." },
  { name: "Rangmanch: Annual Theatre & Street Play Competition", catKey: "cultural", mode: "NONE", price: "FREE", venue: "Open Air Theatre, Unipolis", format: "TEAM", cap: 1500, desc: "Powerful student theatre troupes bring gripping social dramas, satire, and street plays to the main campus stage." },
  { name: "Acoustic Unplugged: Campus Sunset Serenade", catKey: "cultural", mode: "NONE", price: "FREE", venue: "Central Lawns Amphitheatre", format: "INDIVIDUAL", cap: 500, desc: "Unwind at sunset with unplugged indie, blues, and acoustic melodies performed by talented campus singer-songwriters." },
  { name: "Kavi Sammelan: Hindi & Punjabi Poetry Evening", catKey: "cultural", mode: "NONE", price: "FREE", venue: "Baldev Raj Mittal Hall 3", format: "INDIVIDUAL", cap: 400, desc: "An evening of mesmerizing verses, heartfelt ghazals, and inspiring spoken word poetry by student and guest poets." },
  { name: "Symphony: Orchestra & Western Classical Ensemble", catKey: "cultural", mode: "NONE", price: "FREE", venue: "Block 32, Auditorium", format: "INDIVIDUAL", cap: 600, desc: "A grand western classical and cinematic orchestra performance celebrating iconic film scores and symphonic masterpieces." },

  // Innovation & Entrepreneurship (6)
  { name: "Campus Pitch Tank: Seed Investment Pitching 2026", catKey: "entrepreneurship", mode: "EXTERNAL", price: "FREE", venue: "Startup Incubation Center, Block 30", format: "TEAM", cap: 200, desc: "Student founders pitch innovative business prototypes to leading venture capitalists and angel investors for seed funding." },
  { name: "Venture Capital & Angel Investing Roundtable", catKey: "entrepreneurship", mode: "EXTERNAL", price: "FREE", venue: "Mittal School of Business Executive Lounge", format: "INDIVIDUAL", cap: 100, desc: "An intimate fireside discussion on startup valuation, term sheets, cap table management, and early-stage scaling." },
  { name: "E-Cell Product Hunt & Growth Hacking Summit", catKey: "entrepreneurship", mode: "EXTERNAL", price: "FREE", venue: "Block 30, Innovation Hall A", format: "INDIVIDUAL", cap: 220, desc: "Actionable growth frameworks, SEO hacking, and product-led growth strategies for early-stage digital products." },
  { name: "Agri-Tech & Sustainable Farming Hackathon", catKey: "innovation", mode: "EXTERNAL", price: "FREE", venue: "School of Agriculture Greenhouse Lab", format: "TEAM", cap: 160, desc: "Develop IoT soil sensors, automated hydroponics, and AI pest detection solutions to empower modern Indian farmers." },
  { name: "CleanTech & Green Energy Prototype Exhibition", catKey: "innovation", mode: "NONE", price: "FREE", venue: "Unipolis Exhibition Ground", format: "TEAM", cap: 400, desc: "Witness working prototypes of solar tracking arrays, electric vehicle battery management systems, and bio-gas innovations." },
  { name: "Smart Campus IoT Hackathon & Solution Challenge", catKey: "innovation", mode: "EXTERNAL", price: "FREE", venue: "IoT & Smart Cities Lab, Block 29", format: "TEAM", cap: 200, desc: "Design and deploy smart energy meters, automated parking detectors, and campus water conservation sensors." },

  // Student Clubs & Co-Curricular (8)
  { name: "HackLPU 2026: 36-Hour National Hackathon", catKey: "student-clubs-org", mode: "EXTERNAL", price: "FREE", venue: "Indoor Sports Complex Hall A", format: "TEAM", cap: 600, desc: "36 hours of non-stop code, caffeine, and innovation with ₹5,00,000 in prizes across AI, Web3, FinTech, and Social Good." },
  { name: "Competitive Programming Arena: Fall Cup 2026", catKey: "student-clubs-org", mode: "EXTERNAL", price: "FREE", venue: "Block 38, Lab 1 & 2", format: "INDIVIDUAL", cap: 150, desc: "Fast-paced algorithmic problem-solving sprint testing graph algorithms, dynamic programming, and data structures." },
  { name: "Campus Photography & Cinematography Photowalk", catKey: "co-curricular", mode: "EXTERNAL", price: "FREE", venue: "Meeting Point: Unipolis Gate 1", format: "INDIVIDUAL", cap: 80, desc: "Learn golden-hour portraiture, architectural framing, and cinematic b-roll techniques across picturesque campus spots." },
  { name: "Graphic Design & UI/UX Design Sprint 2026", catKey: "co-curricular", mode: "EXTERNAL", price: "FREE", venue: "Design Studio 204, Block 27", format: "INDIVIDUAL", cap: 100, desc: "A rapid 6-hour wireframing, typography, and micro-interaction design sprint using industry-standard design tools." },
  { name: "Debate Premier League: National Parliamentary Debate", catKey: "co-curricular", mode: "EXTERNAL", price: "FREE", venue: "Law Auditorium, Block 14", format: "TEAM", cap: 120, desc: "Top campus debaters clash on global geopolitics, economic reforms, and technology policy under Asian Parliamentary format." },
  { name: "Campus Model United Nations (LPU MUN) 2026", catKey: "co-curricular", mode: "EXTERNAL", price: "FREE", venue: "Block 14, Committee Rooms", format: "INDIVIDUAL", cap: 250, desc: "Simulate UNSC, UNHRC, and Lok Sabha committees to debate critical international security and human rights crises." },
  { name: "CyberSecurity Capture The Flag (CTF) Tournament", catKey: "student-clubs-org", mode: "EXTERNAL", price: "FREE", venue: "Cyber Forensics Lab, Block 38", format: "TEAM", cap: 180, desc: "Test your skills in binary exploitation, reverse engineering, web application vulnerabilities, and cryptography." },
  { name: "Game Dev & Unreal Engine VR Experience Day", catKey: "student-clubs-org", mode: "NONE", price: "FREE", venue: "VR Immersion Lab, Block 32", format: "INDIVIDUAL", cap: 300, desc: "Step into virtual reality worlds built by student game developers using Unreal Engine 5 and real-time ray tracing." },

  // NCC, NSS & Community Services (6)
  { name: "NCC Ceremonial Drill & Leadership Passing Out Parade", catKey: "ncc", mode: "NONE", price: "FREE", venue: "Main University Parade Ground", format: "INDIVIDUAL", cap: 2000, desc: "A majestic ceremonial march and weapon display celebrating the dedication, discipline, and valor of LPU NCC cadets." },
  { name: "NSS Mega Blood Donation & Health Awareness Camp", catKey: "nss", mode: "NONE", price: "FREE", venue: "Uni-Hospital Medical Center Lawn", format: "INDIVIDUAL", cap: 1000, desc: "Join hands with the Red Cross and NSS volunteers to donate blood and spread vital awareness on preventive community health." },
  { name: "Community Outreach: Digital Literacy Drive for Rural Schools", catKey: "community-services", mode: "EXTERNAL", price: "FREE", venue: "Block 30, Community Hall", format: "INDIVIDUAL", cap: 150, desc: "Volunteer to teach basic computer operations, internet safety, and coding fundamentals to visiting rural school students." },
  { name: "Clean Green Campus: Tree Plantation & Eco-Pledge", catKey: "community-services", mode: "NONE", price: "FREE", venue: "Botanical Garden, North Campus", format: "INDIVIDUAL", cap: 500, desc: "Plant native saplings and take the campus sustainability pledge towards a zero-waste, carbon-neutral university." },
  { name: "Disaster Preparedness & First Aid Certified Training", catKey: "nss", mode: "EXTERNAL", price: "FREE", venue: "Block 32, First Aid Training Center", format: "INDIVIDUAL", cap: 120, desc: "Certified hands-on training in CPR, emergency trauma management, and disaster response led by certified medical instructors." },
  { name: "NCC Obstacle Course & Tactical Obstacle Challenge", catKey: "ncc", mode: "NONE", price: "FREE", venue: "NCC Obstacle Ground, South Zone", format: "INDIVIDUAL", cap: 300, desc: "Compete in an intense 10-stage military obstacle course testing endurance, agility, teamwork, and tactical problem-solving." },

  // Fashion & Design (4)
  { name: "LPU Couture 2026: Annual Fashion Runway Showcase", catKey: "fashion", mode: "NONE", price: "FREE", venue: "Baldev Raj Mittal Unipolis Arena", format: "INDIVIDUAL", cap: 2500, desc: "Witness avant-garde couture, sustainable streetwear, and ethnic ensembles designed by graduating fashion design students." },
  { name: "Sustainable Textile & Upcycled Apparel Exhibition", catKey: "fashion", mode: "NONE", price: "FREE", venue: "Design Studio Gallery, Block 27", format: "INDIVIDUAL", cap: 350, desc: "An artistic exhibition showcasing wearable art created entirely from post-consumer waste and recycled handloom textiles." },
  { name: "Fine Arts & Live Canvas Painting Marathon", catKey: "cultural", mode: "EXTERNAL", price: "FREE", venue: "Central Sculpture Garden", format: "INDIVIDUAL", cap: 120, desc: "Artists paint live on massive outdoor canvases capturing campus life, surrealism, and abstract expressionism." },
  { name: "Clay Sculpting & Pottery Artisan Workshop", catKey: "cultural", mode: "EXTERNAL", price: "FREE", venue: "Fine Arts Studio, Block 27", format: "INDIVIDUAL", cap: 60, desc: "Learn wheel throwing, terracotta pottery molding, and glaze techniques under the guidance of traditional master potters." },

  // Day Celebrations & Schools (8)
  { name: "International Literacy Day: Global Book & Authors Fair", catKey: "day-celebrations", mode: "NONE", price: "FREE", venue: "Central Library Grand Atrium", format: "INDIVIDUAL", cap: 1200, desc: "Browse thousands of books, attend author signings, and participate in literary quizzes celebrating World Literacy Day." },
  { name: "World Tourism Day: Global Culinary & Travel Expo", catKey: "day-celebrations", mode: "NONE", price: "FREE", venue: "School of Hotel Management Lawns", format: "INDIVIDUAL", cap: 1500, desc: "Taste authentic global cuisines prepared live by culinary students and explore international travel culture booths." },
  { name: "National Science Day: Inter-School Science Expo", catKey: "day-celebrations", mode: "NONE", price: "FREE", venue: "Science Block 31 Atrium", format: "INDIVIDUAL", cap: 800, desc: "Inspiring interactive physics, chemistry, and space experiments demonstrated by university scholars for visiting students." },
  { name: "School of Law: National Moot Court Competition 2026", catKey: "schools", mode: "EXTERNAL", price: "FREE", venue: "Moot Court Hall, Block 14", format: "TEAM", cap: 150, desc: "Top law students present oral arguments before esteemed high court judges on constitutional law and data privacy." },
  { name: "School of Management: Business Case Analysis Championship", catKey: "schools", mode: "EXTERNAL", price: "FREE", venue: "Mittal School of Business Auditorium", format: "TEAM", cap: 180, desc: "Analyze real-world Harvard business cases on supply chain bottlenecks, turnarounds, and disruptive market entry." },
  { name: "School of Pharmacy: Clinical Research & Drug Discovery Forum", catKey: "schools", mode: "EXTERNAL", price: "FREE", venue: "Pharmacy Block 26 Seminar Hall", format: "INDIVIDUAL", cap: 140, desc: "Exploring computational drug design, targeted nanotechnology delivery systems, and global clinical trial compliance." },
  { name: "School of Architecture: Sustainable Urban Design Expo", catKey: "schools", mode: "NONE", price: "FREE", venue: "Architecture Exhibition Hall, Block 27", format: "INDIVIDUAL", cap: 300, desc: "Scale architectural models and 3D renderings of smart city concepts, net-zero buildings, and green public spaces." },
  { name: "School of Education: Modern Pedagogies & EdTech Summit", catKey: "schools", mode: "EXTERNAL", price: "FREE", venue: "Block 13 Auditorium", format: "INDIVIDUAL", cap: 160, desc: "Panel discussion on gamified learning, AI in classroom assessments, and neurodiverse pedagogical frameworks." },

  // Others & Campus Life (4)
  { name: "LPU Alumni Homecoming: Mentorship & Networking Conclave", catKey: "others", mode: "EXTERNAL", price: "FREE", venue: "Shanti Devi Mittal Auditorium", format: "INDIVIDUAL", cap: 1000, desc: "Connect with distinguished alumni leaders from Fortune 500 tech companies, global consulting firms, and public civil services." },
  { name: "Campus Fitness & Marathon 10K / 5K Run", catKey: "others", mode: "EXTERNAL", price: "FREE", venue: "Start Point: Main Sports Stadium", format: "INDIVIDUAL", cap: 2000, desc: "Lace up your running shoes for a high-energy campus marathon promoting cardiovascular health and athletic endurance." },
  { name: "Mental Health & Mindfulness Meditation Workshop", catKey: "others", mode: "NONE", price: "FREE", venue: "Yoga & Wellness Center, Block 20", format: "INDIVIDUAL", cap: 250, desc: "Guided breathing techniques, sound healing, and cognitive stress-relief practices to enhance student emotional wellbeing." },
  { name: "International Student Cultural Exchange & Food Festival", catKey: "others", mode: "NONE", price: "FREE", venue: "Unipolis Food Court Arena", format: "INDIVIDUAL", cap: 3000, desc: "A colorful global extravaganza with students from over 50 countries showcasing traditional attire, music, and food." }
];

async function generateSeedSql() {
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

  const superAdminId = '0f159cb9-b672-499d-a9b6-d61d370342a5';

  const catMap = {};
  for (const c of categories) {
    catMap[c.key] = c;
  }

  const subsByCat = {};
  for (const s of subcategories) {
    if (!subsByCat[s.category_id]) subsByCat[s.category_id] = [];
    subsByCat[s.category_id].push(s);
  }

  const todaySlots = [
    { start: '2026-09-07 11:30:00+05:30', end: '2026-09-07 13:30:00+05:30' },
    { start: '2026-09-07 12:00:00+05:30', end: '2026-09-07 14:30:00+05:30' },
    { start: '2026-09-07 12:30:00+05:30', end: '2026-09-07 15:00:00+05:30' },
    { start: '2026-09-07 13:00:00+05:30', end: '2026-09-07 16:00:00+05:30' },
    { start: '2026-09-07 13:30:00+05:30', end: '2026-09-07 16:30:00+05:30' },
    { start: '2026-09-07 14:00:00+05:30', end: '2026-09-07 17:00:00+05:30' },
    { start: '2026-09-07 14:30:00+05:30', end: '2026-09-07 17:30:00+05:30' },
    { start: '2026-09-07 15:00:00+05:30', end: '2026-09-07 18:00:00+05:30' },
    { start: '2026-09-07 15:30:00+05:30', end: '2026-09-07 18:30:00+05:30' },
    { start: '2026-09-07 16:00:00+05:30', end: '2026-09-07 19:00:00+05:30' },
    { start: '2026-09-07 16:30:00+05:30', end: '2026-09-07 19:30:00+05:30' },
    { start: '2026-09-07 17:00:00+05:30', end: '2026-09-07 20:00:00+05:30' },
    { start: '2026-09-07 17:30:00+05:30', end: '2026-09-07 20:30:00+05:30' },
    { start: '2026-09-07 18:00:00+05:30', end: '2026-09-07 21:00:00+05:30' },
    { start: '2026-09-07 18:30:00+05:30', end: '2026-09-07 21:30:00+05:30' },
    { start: '2026-09-07 19:00:00+05:30', end: '2026-09-07 22:30:00+05:30' },
  ];

  const tomorrowSlots = [
    { start: '2026-09-08 09:00:00+05:30', end: '2026-09-08 12:00:00+05:30' },
    { start: '2026-09-08 09:30:00+05:30', end: '2026-09-08 13:00:00+05:30' },
    { start: '2026-09-08 10:00:00+05:30', end: '2026-09-08 14:00:00+05:30' },
    { start: '2026-09-08 10:30:00+05:30', end: '2026-09-08 14:30:00+05:30' },
    { start: '2026-09-08 11:00:00+05:30', end: '2026-09-08 15:00:00+05:30' },
    { start: '2026-09-08 11:30:00+05:30', end: '2026-09-08 15:30:00+05:30' },
    { start: '2026-09-08 12:00:00+05:30', end: '2026-09-08 16:00:00+05:30' },
    { start: '2026-09-08 13:00:00+05:30', end: '2026-09-08 16:30:00+05:30' },
    { start: '2026-09-08 13:30:00+05:30', end: '2026-09-08 17:00:00+05:30' },
    { start: '2026-09-08 14:00:00+05:30', end: '2026-09-08 17:30:00+05:30' },
    { start: '2026-09-08 14:30:00+05:30', end: '2026-09-08 18:00:00+05:30' },
    { start: '2026-09-08 15:00:00+05:30', end: '2026-09-08 18:30:00+05:30' },
    { start: '2026-09-08 15:30:00+05:30', end: '2026-09-08 19:00:00+05:30' },
    { start: '2026-09-08 16:00:00+05:30', end: '2026-09-08 19:30:00+05:30' },
    { start: '2026-09-08 16:30:00+05:30', end: '2026-09-08 20:00:00+05:30' },
    { start: '2026-09-08 17:00:00+05:30', end: '2026-09-08 20:30:00+05:30' },
    { start: '2026-09-08 17:30:00+05:30', end: '2026-09-08 21:00:00+05:30' },
  ];

  const dayAfterSlots = [
    { start: '2026-09-09 09:00:00+05:30', end: '2026-09-09 12:00:00+05:30' },
    { start: '2026-09-09 09:30:00+05:30', end: '2026-09-09 13:00:00+05:30' },
    { start: '2026-09-09 10:00:00+05:30', end: '2026-09-09 14:00:00+05:30' },
    { start: '2026-09-09 10:30:00+05:30', end: '2026-09-09 14:30:00+05:30' },
    { start: '2026-09-09 11:00:00+05:30', end: '2026-09-09 15:00:00+05:30' },
    { start: '2026-09-09 11:30:00+05:30', end: '2026-09-09 15:30:00+05:30' },
    { start: '2026-09-09 12:00:00+05:30', end: '2026-09-09 16:00:00+05:30' },
    { start: '2026-09-09 13:00:00+05:30', end: '2026-09-09 16:30:00+05:30' },
    { start: '2026-09-09 13:30:00+05:30', end: '2026-09-09 17:00:00+05:30' },
    { start: '2026-09-09 14:00:00+05:30', end: '2026-09-09 17:30:00+05:30' },
    { start: '2026-09-09 14:30:00+05:30', end: '2026-09-09 18:00:00+05:30' },
    { start: '2026-09-09 15:00:00+05:30', end: '2026-09-09 18:30:00+05:30' },
    { start: '2026-09-09 15:30:00+05:30', end: '2026-09-09 19:00:00+05:30' },
    { start: '2026-09-09 16:00:00+05:30', end: '2026-09-09 19:30:00+05:30' },
    { start: '2026-09-09 16:30:00+05:30', end: '2026-09-09 20:00:00+05:30' },
    { start: '2026-09-09 17:00:00+05:30', end: '2026-09-09 20:30:00+05:30' },
    { start: '2026-09-09 17:30:00+05:30', end: '2026-09-09 21:00:00+05:30' },
  ];

  const allSlots = [...todaySlots, ...tomorrowSlots, ...dayAfterSlots];

  let sql = `-- LPU Events Production Fresh 50-Event Seed
-- Target: nhjphyqiqhmxdhppljap (PostgreSQL 17)
-- Execution: Transactional

BEGIN;

-- 1. Safely delete existing event-dependent records
DELETE FROM public.event_content_sections;
DELETE FROM public.featured_events;
DELETE FROM public.trending_events;
DELETE FROM public.carousel_items WHERE event_id IS NOT NULL;
DELETE FROM public.events;

-- 2. Insert exactly 50 fresh production events
`;

  const eventIds = [];

  for (let i = 0; i < 50; i++) {
    const tmpl = eventTemplates[i];
    const slot = allSlots[i];
    const eventId = `e${String(i + 1).padStart(7, '0')}-0000-0000-0000-000000000000`;
    eventIds.push({ id: eventId, name: tmpl.name, slot: slot });

    const cat = catMap[tmpl.catKey] || categories[i % categories.length];
    const validSubs = subsByCat[cat.id] || [];
    const sub = validSubs.length > 0 ? validSubs[i % validSubs.length] : null;
    const org = organizations[i % organizations.length];
    const media = mediaAssets[i % mediaAssets.length]?.id || null;

    const regUrl = tmpl.mode === 'EXTERNAL' ? `https://lpuevents.live/register/${encodeURIComponent(tmpl.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}` : null;
    const viewCount = Math.floor(Math.random() * 350) + 25;

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
  '${superAdminId}',
  '${superAdminId}',
  ${sqlStr(tmpl.name)},
  ${sqlStr(tmpl.desc)},
  '${cat.id}',
  ${sub ? `'${sub.id}'` : 'NULL'},
  ${media ? `'${media}'` : 'NULL'},
  '${slot.start}',
  '${slot.end}',
  ${sqlStr(tmpl.venue)},
  '${tmpl.mode}',
  ${sqlStr(regUrl)},
  '${tmpl.price}',
  '${tmpl.format}',
  ${tmpl.cap},
  0,
  'PUBLISHED',
  ${viewCount},
  now(),
  now()
);

-- Content sections for event ${i + 1}
INSERT INTO public.event_content_sections (id, event_id, section_type, title, content, sort_order, created_at, updated_at)
VALUES 
(
  gen_random_uuid(), '${eventId}', 'about', 'About the Event',
  ${sqlJsonb({ text: tmpl.desc + " Organized in collaboration with university faculty, student chapters, and industry partners to foster interdisciplinary learning." })},
  1, now(), now()
),
(
  gen_random_uuid(), '${eventId}', 'highlights', 'Key Highlights & Takeaways',
  ${sqlJsonb({ bullet_points: [
    "Interactive hands-on session with experienced mentors",
    "Certificate of Participation awarded to all registered attendees",
    "Networking opportunity with peers and campus student leaders",
    "Live Q&A and project demonstration opportunity"
  ] })},
  2, now(), now()
),
(
  gen_random_uuid(), '${eventId}', 'eligibility', 'Eligibility & Venue Details',
  ${sqlJsonb({ text: "Open to all currently enrolled LPU students across all academic disciplines. Please carry your physical Student ID card for verification at " + tmpl.venue + "." })},
  3, now(), now()
);
`;
  }

  // 3. Populate featured_events (3 events)
  sql += `
-- 3. Curate Top 3 Featured Events
INSERT INTO public.featured_events (event_id, sort_order, created_by, created_at, updated_at)
VALUES 
  ('${eventIds[0].id}', 1, '${superAdminId}', now(), now()),
  ('${eventIds[8].id}', 2, '${superAdminId}', now(), now()),
  ('${eventIds[20].id}', 3, '${superAdminId}', now(), now());

-- 4. Curate Top 5 Trending Events
INSERT INTO public.trending_events (event_id, sort_order, created_by, created_at, updated_at)
VALUES
  ('${eventIds[0].id}', 1, '${superAdminId}', now(), now()),
  ('${eventIds[8].id}', 2, '${superAdminId}', now(), now()),
  ('${eventIds[14].id}', 3, '${superAdminId}', now(), now()),
  ('${eventIds[20].id}', 4, '${superAdminId}', now(), now()),
  ('${eventIds[28].id}', 5, '${superAdminId}', now(), now());

-- 5. Add Hero Carousel Items for Events
INSERT INTO public.carousel_items (id, item_type, event_id, sort_order, is_active, start_at, end_at, created_by, updated_by, display_duration_ms, badge_text, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'EVENT', '${eventIds[0].id}', 1, true, now() - interval '1 hour', now() + interval '3 days', '${superAdminId}', '${superAdminId}', 5000, 'FEATURED SYMPOSIUM', now(), now()),
  (gen_random_uuid(), 'EVENT', '${eventIds[8].id}', 2, true, now() - interval '1 hour', now() + interval '3 days', '${superAdminId}', '${superAdminId}', 5000, 'CAMPUS MEGA NIGHT', now(), now()),
  (gen_random_uuid(), 'EVENT', '${eventIds[20].id}', 3, true, now() - interval '1 hour', now() + interval '3 days', '${superAdminId}', '${superAdminId}', 5000, 'NATIONAL HACKATHON', now(), now());


-- 6. Synchronize Resource Versions
UPDATE public.resource_versions SET version = version + 1, updated_at = now() WHERE resource IN ('events', 'featured', 'carousel', 'categories');

-- 7. Audit Log Entry
INSERT INTO public.audit_logs (id, actor_admin_id, actor_role, action, target_type, target_id, reason, created_at)
VALUES (
  gen_random_uuid(),
  '${superAdminId}',
  'SUPER_ADMIN',
  'PRODUCTION_TEST_DATASET_RESET',
  'events',
  '00000000-0000-0000-0000-000000000000',
  'Intentional production dataset reset to 50 active test events (16 Today, 17 Tomorrow, 17 Day After Tomorrow)',
  now()
);

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`;

  const outputPath = path.join(__dirname, '../supabase/seed_fresh_50_events.sql');
  fs.writeFileSync(outputPath, sql, 'utf8');
  console.log(`✅ Successfully generated seed SQL file at ${outputPath} (${Buffer.byteLength(sql, 'utf8')} bytes)`);
}

generateSeedSql();
