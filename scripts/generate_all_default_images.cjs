const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('../lpu-events-student/node_modules/sharp');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_IMG = 'file:///Users/subhamkumar/.gemini/antigravity-ide/brain/76ac0719-068d-44ff-9de9-b53a0c528636/scratch/clean_lpu_stage_pristine.png';
const SEAL_IMG = 'file:///Users/subhamkumar/Desktop/lpu1/.agents/assets/lpu_seal.png';

const TARGET_DIRS = [
  path.resolve(__dirname, '../lpu-events-student/public/defaults/events/subcategories'),
  path.resolve(__dirname, '../lpu-events-admin/public/defaults/events/subcategories'),
  path.resolve(__dirname, '../lpu-events/apps/student-web/public/defaults/events/subcategories')
];

// Ensure target directories exist
TARGET_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const SUB_CATEGORIES = [
  // 1. Academics
  { file: 'academics_seminar.webp', part1: 'Semi', part2: 'nar', isSingleLine: true },
  { file: 'academics_guest-lecture.webp', part1: 'Guest', part2: 'Lecture', isSingleLine: false },
  { file: 'academics_workshop.webp', part1: 'Work', part2: 'shop', isSingleLine: true },
  { file: 'academics_internship.webp', part1: 'Intern', part2: 'ship', isSingleLine: true },
  { file: 'academics_capstone.webp', part1: 'Cap', part2: 'stone', isSingleLine: true },
  { file: 'academics_others.webp', part1: 'Academic', part2: 'Events', isSingleLine: false },

  // 2. Cultural
  { file: 'cultural_music.webp', part1: 'Mu', part2: 'sic', isSingleLine: true },
  { file: 'cultural_dance.webp', part1: 'Dan', part2: 'ce', isSingleLine: true },
  { file: 'cultural_theatre.webp', part1: 'Thea', part2: 'tre', isSingleLine: true },
  { file: 'cultural_social-media.webp', part1: 'Social', part2: 'Media', isSingleLine: false },
  { file: 'cultural_others.webp', part1: 'Cultural', part2: 'Events', isSingleLine: false },

  // 3. Innovation
  { file: 'innovation_hackathon.webp', part1: 'Hacka', part2: 'thon', isSingleLine: true },
  { file: 'innovation_technical-events.webp', part1: 'Technical', part2: 'Events', isSingleLine: false },
  { file: 'innovation_project-expo.webp', part1: 'Project', part2: 'Expo', isSingleLine: false },
  { file: 'innovation_workshop.webp', part1: 'Tech', part2: 'Workshop', isSingleLine: false },
  { file: 'innovation_seminar.webp', part1: 'Tech', part2: 'Seminar', isSingleLine: false },
  { file: 'innovation_others.webp', part1: 'Inno', part2: 'vation', isSingleLine: true },

  // 4. Entrepreneurship
  { file: 'entrepreneurship_b-plan-competition.webp', part1: 'B-Plan', part2: 'Competition', isSingleLine: false },
  { file: 'entrepreneurship_pitch-fest.webp', part1: 'Pitch', part2: 'Fest', isSingleLine: false },
  { file: 'entrepreneurship_conclave.webp', part1: 'Con', part2: 'clave', isSingleLine: true },
  { file: 'entrepreneurship_bootcamp.webp', part1: 'Boot', part2: 'camp', isSingleLine: true },
  { file: 'entrepreneurship_panel-discussion.webp', part1: 'Panel', part2: 'Discussion', isSingleLine: false },
  { file: 'entrepreneurship_expo.webp', part1: 'Startup', part2: 'Expo', isSingleLine: false },
  { file: 'entrepreneurship_seminar.webp', part1: 'E-Cell', part2: 'Seminar', isSingleLine: false },
  { file: 'entrepreneurship_others.webp', part1: 'Entrepre', part2: 'neurship', isSingleLine: true },

  // 5. Community Services
  { file: 'community-services_donation-drives.webp', part1: 'Donation', part2: 'Drives', isSingleLine: false },
  { file: 'community-services_environment.webp', part1: 'Environ', part2: 'ment', isSingleLine: true },
  { file: 'community-services_healthcare.webp', part1: 'Health', part2: 'care', isSingleLine: true },
  { file: 'community-services_others.webp', part1: 'Community', part2: 'Services', isSingleLine: false },

  // 6. Day Celebrations
  { file: 'day-celebrations_national-days.webp', part1: 'National', part2: 'Days', isSingleLine: false },
  { file: 'day-celebrations_cultural-days.webp', part1: 'Cultural', part2: 'Days', isSingleLine: false },
  { file: 'day-celebrations_fest-days.webp', part1: 'Fest', part2: 'Days', isSingleLine: false },
  { file: 'day-celebrations_awareness-days.webp', part1: 'Awareness', part2: 'Days', isSingleLine: false },
  { file: 'day-celebrations_others.webp', part1: 'Cele', part2: 'brations', isSingleLine: true },

  // 7. Co-Curricular
  { file: 'co-curricular_skill-development.webp', part1: 'Skill', part2: 'Development', isSingleLine: false },
  { file: 'co-curricular_certifications.webp', part1: 'Certifi', part2: 'cations', isSingleLine: true },
  { file: 'co-curricular_training-programs.webp', part1: 'Training', part2: 'Programs', isSingleLine: false },
  { file: 'co-curricular_competitions.webp', part1: 'Competi', part2: 'tions', isSingleLine: true },
  { file: 'co-curricular_others.webp', part1: 'Co-Cur', part2: 'ricular', isSingleLine: true },

  // 8. Student Clubs & Org
  { file: 'student-clubs_technical-clubs.webp', part1: 'Technical', part2: 'Clubs', isSingleLine: false },
  { file: 'student-clubs_cultural-clubs.webp', part1: 'Cultural', part2: 'Clubs', isSingleLine: false },
  { file: 'student-clubs_startup-clubs.webp', part1: 'Startup', part2: 'Clubs', isSingleLine: false },
  { file: 'student-clubs_literary-clubs.webp', part1: 'Literary', part2: 'Clubs', isSingleLine: false },
  { file: 'student-clubs_others.webp', part1: 'Student', part2: 'Clubs', isSingleLine: false },

  // 9. NCC
  { file: 'ncc_camps.webp', part1: 'NCC', part2: 'Camps', isSingleLine: false },
  { file: 'ncc_training.webp', part1: 'NCC', part2: 'Training', isSingleLine: false },
  { file: 'ncc_parades.webp', part1: 'NCC', part2: 'Parades', isSingleLine: false },
  { file: 'ncc_others.webp', part1: 'NCC', part2: 'Events', isSingleLine: false },

  // 10. NSS
  { file: 'nss_social-work.webp', part1: 'Social', part2: 'Work', isSingleLine: false },
  { file: 'nss_campaigns.webp', part1: 'NSS', part2: 'Campaigns', isSingleLine: false },
  { file: 'nss_awareness-drives.webp', part1: 'Awareness', part2: 'Drives', isSingleLine: false },
  { file: 'nss_others.webp', part1: 'NSS', part2: 'Events', isSingleLine: false },

  // 11. Fashion
  { file: 'fashion_shows.webp', part1: 'Fashion', part2: 'Shows', isSingleLine: false },
  { file: 'fashion_exhibitions.webp', part1: 'Fashion', part2: 'Exhibitions', isSingleLine: false },
  { file: 'fashion_others.webp', part1: 'Fashion', part2: 'Events', isSingleLine: false },

  // 12. Others
  { file: 'others_miscellaneous-events.webp', part1: 'Campus', part2: 'Events', isSingleLine: false },

  // 13. Schools (Generic School default)
  { file: 'schools.webp', part1: 'Schools', part2: 'of LPU', isSingleLine: false }
];

function generateHtml(item) {
  const { part1, part2, isSingleLine } = item;
  
  let fontSize, letterSpacing, barWidth, titleHtml, topOffset;

  if (isSingleLine) {
    const totalLen = (part1 + part2).length;
    if (totalLen <= 7) {
      fontSize = 138;
      letterSpacing = -3;
      barWidth = 600;
      topOffset = 330;
    } else if (totalLen <= 10) {
      fontSize = 120;
      letterSpacing = -2.5;
      barWidth = 590;
      topOffset = 335;
    } else {
      fontSize = 98;
      letterSpacing = -2;
      barWidth = 570;
      topOffset = 345;
    }
    titleHtml = `<div class="title-text"><span class="title-part1">${part1}</span><span class="title-part2">${part2}</span></div>`;
  } else {
    const maxLineLen = Math.max(part1.length, part2.length);
    if (maxLineLen <= 8) {
      fontSize = 104;
      letterSpacing = -2.5;
      barWidth = 550;
      topOffset = 285;
    } else if (maxLineLen <= 12) {
      fontSize = 88;
      letterSpacing = -2;
      barWidth = 560;
      topOffset = 300;
    } else {
      fontSize = 76;
      letterSpacing = -1.5;
      barWidth = 570;
      topOffset = 315;
    }
    titleHtml = `
      <div class="title-text-multi">
        <div class="title-line1"><span class="title-part1">${part1}</span></div>
        <div class="title-line2"><span class="title-part2">${part2}</span></div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Outfit:wght@700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px;
    height: 800px;
    overflow: hidden;
    background: #050a14;
    position: relative;
    font-family: 'Plus Jakarta Sans', 'Outfit', -apple-system, sans-serif;
  }
  .bg-container {
    position: absolute;
    top: 0; left: 0;
    width: 1920px; height: 800px;
    background-image: url('${BASE_IMG}');
    background-size: 1920px 800px;
    background-repeat: no-repeat;
    filter: brightness(0.85) contrast(1.15) saturate(1.08);
  }
  .vignette {
    position: absolute;
    top: 0; left: 0;
    width: 1920px; height: 800px;
    background: radial-gradient(circle at 55% 45%, rgba(4, 9, 20, 0.35) 0%, rgba(2, 6, 15, 0.55) 75%, transparent 100%),
                radial-gradient(circle at 85% 50%, transparent 40%, rgba(2, 5, 12, 0.45) 95%),
                linear-gradient(to right, rgba(2, 6, 16, 0.55) 0%, rgba(2, 6, 16, 0.2) 32%, transparent 55%);
    pointer-events: none;
  }
  .top-left-corner {
    position: absolute;
    top: 0; left: 0;
    width: 220px; height: 220px;
    background: linear-gradient(135deg, #ff7a00 0%, #e65100 100%);
    clip-path: polygon(0 0, 100% 0, 0 100%);
    z-index: 15;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
  }
  .top-left-corner::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 10px,
      rgba(0, 0, 0, 0.2) 10px,
      rgba(0, 0, 0, 0.2) 13px
    );
  }
  .brand-lockup {
    position: absolute;
    top: 55px; left: 80px;
    display: flex; align-items: center; gap: 22px;
    z-index: 20;
  }
  .brand-seal-wrapper {
    width: 110px; height: 110px;
    border-radius: 50%;
    background: #ffffff;
    padding: 3px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 122, 0, 0.3);
    display: flex; align-items: center; justify-content: center;
  }
  .brand-seal {
    width: 100%; height: 100%;
    border-radius: 50%; object-fit: cover;
  }
  .brand-divider {
    width: 2.5px; height: 72px;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 2px;
  }
  .brand-text {
    display: flex; flex-direction: column; justify-content: center; gap: 3px;
  }
  .brand-lpu {
    font-size: 34px; font-weight: 900; color: #ff7a00;
    letter-spacing: 2px; line-height: 1.0;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.7));
  }
  .brand-events {
    font-size: 30px; font-weight: 800; color: #ffffff;
    letter-spacing: 4px; line-height: 1.0;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.7));
  }
  .title-container {
    position: absolute;
    left: 80px;
    top: ${topOffset}px;
    max-width: 680px;
    z-index: 20;
  }
  .title-text {
    font-size: ${fontSize}px;
    font-weight: 900;
    line-height: 1.0;
    letter-spacing: ${letterSpacing}px;
    display: flex;
    align-items: baseline;
    filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.85));
  }
  .title-text-multi {
    font-size: ${fontSize}px;
    font-weight: 900;
    line-height: 1.08;
    letter-spacing: ${letterSpacing}px;
    display: flex;
    flex-direction: column;
    filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.85));
  }
  .title-part1 { color: #ffffff; }
  .title-part2 {
    background: linear-gradient(135deg, #ffba1a 0%, #ff8500 50%, #e64a00 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .title-bar {
    width: ${barWidth}px;
    height: 11px;
    margin-top: 18px;
    border-radius: 6px;
    background: linear-gradient(to right, #ff7a00 0%, #ff9800 50%, rgba(255, 255, 255, 0.95) 54%, rgba(180, 195, 220, 0.5) 100%);
    box-shadow: 0 2px 14px rgba(255, 122, 0, 0.7);
  }
</style>
</head>
<body>
  <div class="bg-container"></div>
  <div class="vignette"></div>
  <div class="top-left-corner"></div>
  <div class="brand-lockup">
    <div class="brand-seal-wrapper">
      <img class="brand-seal" src="${SEAL_IMG}" alt="LPU Seal">
    </div>
    <div class="brand-divider"></div>
    <div class="brand-text">
      <span class="brand-lpu">LPU</span>
      <span class="brand-events">EVENTS</span>
    </div>
  </div>
  <div class="title-container">
    ${titleHtml}
    <div class="title-bar"></div>
  </div>
</body>
</html>`;
}

async function main() {
  console.log(`Starting generation of ${SUB_CATEGORIES.length} official subcategory default images...`);
  const htmlFile = '/tmp/banner_render.html';
  const pngFile = '/tmp/banner_render.png';

  let successCount = 0;

  for (let i = 0; i < SUB_CATEGORIES.length; i++) {
    const item = SUB_CATEGORIES[i];
    const html = generateHtml(item);
    fs.writeFileSync(htmlFile, html);

    // Render 1920x800 via Chrome
    execSync(`"${CHROME_PATH}" --headless=new --disable-gpu --window-size=1920,800 --screenshot="${pngFile}" file://${htmlFile}`);

    // Convert to optimized WebP buffer via Sharp
    const webpBuffer = await sharp(pngFile)
      .resize(1920, 800, { fit: 'cover' })
      .webp({ quality: 90, effort: 6 })
      .toBuffer();

    // Write buffer to all 3 destination directories
    for (const targetDir of TARGET_DIRS) {
      const destPath = path.join(targetDir, item.file);
      fs.writeFileSync(destPath, webpBuffer);
    }

    successCount++;
    console.log(`[${successCount}/${SUB_CATEGORIES.length}] Generated ${item.file} (${Math.round(webpBuffer.length / 1024)} KB)`);
  }

  console.log(`\n🎉 Successfully generated all ${successCount} official subcategory default images!`);
}

main().catch(err => {
  console.error('Fatal generation error:', err);
  process.exit(1);
});
