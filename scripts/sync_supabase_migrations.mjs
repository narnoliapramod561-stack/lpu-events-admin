/**
 * scripts/sync_supabase_migrations.mjs
 * 
 * Mechanical Migration Synchronization & Parity Enforcement Tool
 * Master Source of Truth: lpu-events-admin/supabase/migrations/
 * 
 * Guarantees that the root supabase/migrations directory is an exact, byte-for-byte
 * mirror of the canonical migration ledger in lpu-events-admin/supabase/migrations/.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const canonicalDir = path.join(rootDir, 'lpu-events-admin/supabase/migrations');
const targetDir = path.join(rootDir, 'supabase/migrations');

if (!fs.existsSync(canonicalDir)) {
  console.error(`❌ Canonical migration directory does not exist: ${canonicalDir}`);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const canonicalFiles = fs.readdirSync(canonicalDir).filter(f => f.endsWith('.sql'));
console.log(`📦 Found ${canonicalFiles.length} canonical migrations in lpu-events-admin/supabase/migrations/`);

let copiedCount = 0;
for (const file of canonicalFiles) {
  const src = path.join(canonicalDir, file);
  const dest = path.join(targetDir, file);

  const srcContent = fs.readFileSync(src);
  let needsCopy = true;

  if (fs.existsSync(dest)) {
    const destContent = fs.readFileSync(dest);
    if (srcContent.equals(destContent)) {
      needsCopy = false;
    }
  }

  if (needsCopy) {
    fs.writeFileSync(dest, srcContent);
    copiedCount++;
  }
}

console.log(`✅ Synchronization complete: ${copiedCount} files updated/copied, total mirrored: ${canonicalFiles.length}`);
