import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

function getLocalLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const ADMIN_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://us.i.posthog.com https://eu.i.posthog.com https://app.posthog.com https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://images.unsplash.com https://upload.wikimedia.org https://*.supabase.co https://api.lpuevents.live https://lpuevents.live https://images.lpuevents.live; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.lpuevents.live wss://api.lpuevents.live https://images.lpuevents.live https://lpuevents.live https://*.lpuevents.live wss://*.lpuevents.live https://us.i.posthog.com https://eu.i.posthog.com https://app.posthog.com https://us-assets.i.posthog.com https://*.cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';"
};

function securityHeadersPlugin(): Plugin {
  return {
    name: 'security-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        for (const [key, value] of Object.entries(ADMIN_SECURITY_HEADERS)) {
          res.setHeader(key, value);
        }
        const url = req.url?.split('?')[0] || '';
        if (
          url === '/_headers' ||
          url === '/_redirects' ||
          url.startsWith('/.') ||
          url === '/package.json' ||
          url === '/package-lock.json' ||
          url === '/tsconfig.json'
        ) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
        next();
      });
    }
  };
}

// In-memory store for local development D1 simulation (port 3001)
const localDevBackups = new Map<string, any>();
let localDevDisasterMode = false;

function localBackupDevPlugin(): Plugin {
  return {
    name: 'local-backup-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/admin/backups')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');

        if (url === '/api/admin/backups/status' && req.method === 'GET') {
          res.statusCode = 200;
          return res.end(JSON.stringify({
            status: 'healthy',
            db_connected: true,
            total_backed_up: localDevBackups.size,
            last_backup_at: localDevBackups.size > 0 ? Array.from(localDevBackups.values())[localDevBackups.size - 1].backed_up_at : new Date().toISOString(),
            disaster_mode: localDevDisasterMode,
            free_tier: {
              d1_storage_limit_bytes: 5368709120,
              d1_writes_limit_daily: 100000,
              estimated_storage_kb: Math.round(localDevBackups.size * 2.5),
              estimated_write_budget_remaining: 100000 - localDevBackups.size,
              egress_cost_usd: 0.00
            }
          }));
        }

        if ((url === '/api/admin/backups' || url.startsWith('/api/admin/backups?')) && req.method === 'GET') {
          res.statusCode = 200;
          return res.end(JSON.stringify({
            ok: true,
            events: Array.from(localDevBackups.values()),
            count: localDevBackups.size,
            is_super_admin: true
          }));
        }

        if (url === '/api/admin/backups/sync-event' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const evId = data.event_id || `ev_${Date.now()}`;
              const snapshot = data.snapshot || {};
              const now = new Date().toISOString();
              const backupRecord = {
                id: evId,
                name: snapshot.name || 'Campus Event',
                venue_name: snapshot.venue_name || 'Campus Auditorium',
                organization_name: snapshot.organization_name || 'LPU Club',
                category_name: snapshot.category_name || 'Technical',
                start_at: snapshot.start_at || now,
                end_at: snapshot.end_at || now,
                pricing_type: snapshot.pricing_type || 'FREE',
                price_amount: snapshot.price_amount || 0,
                status: snapshot.status || 'PUBLISHED',
                backup_version: (localDevBackups.get(evId)?.backup_version || 0) + 1,
                checksum: `sha256_dev_${Math.random().toString(36).substring(2, 10)}`,
                backed_up_at: now,
                backed_up_by: 'local-admin',
                raw_snapshot_json: JSON.stringify(snapshot)
              };
              localDevBackups.set(evId, backupRecord);
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true, id: evId, version: backupRecord.backup_version, checksum: backupRecord.checksum, backed_up_at: now }));
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Malformed JSON' }));
            }
          });
          return;
        }

        if (url === '/api/admin/backups/disaster-mode' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              if (typeof data.enabled === 'boolean') {
                localDevDisasterMode = data.enabled;
              }
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true, disaster_mode: localDevDisasterMode }));
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Malformed JSON' }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), securityHeadersPlugin(), localBackupDevPlugin()],
  define: {
    'import.meta.env.VITE_DEV_LAN_IP': JSON.stringify(getLocalLanIp()),
  },
  resolve: {
    alias: {
      '@lpu-events/shared': path.resolve(__dirname, fs.existsSync(path.resolve(__dirname, './src/shared')) ? './src/shared' : './src/shared/index.ts')
    }
  },
  server: {
    port: 3001,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'https://lpuevents.live',
        changeOrigin: true,
        secure: true,
      },
      '/public-content': {
        target: 'https://images.lpuevents.live',
        changeOrigin: true,
        secure: true,
      }
    },
    fs: {
      strict: true,
      deny: ['.env', '.env.*', '*.{crt,pem}', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.*', '_headers', '_redirects']
    }
  },
  build: {
    target: 'es2022',
    sourcemap: process.env.CI ? 'hidden' : false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('posthog-js')) return 'vendor-posthog';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('qrcode')) return 'vendor-qrcode';
            return 'vendor-misc';
          }
        }
      }
    }
  },
  preview: {
    port: 3001,
    strictPort: true,
    headers: ADMIN_SECURITY_HEADERS
  }
});
