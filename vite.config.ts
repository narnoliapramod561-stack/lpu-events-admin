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
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.clarity.ms https://scripts.clarity.ms https://us.i.posthog.com https://eu.i.posthog.com https://app.posthog.com https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://images.unsplash.com https://upload.wikimedia.org https://*.supabase.co https://api.lpuevents.live https://lpuevents.live https://images.lpuevents.live https://*.clarity.ms https://c.bing.com; connect-src 'self' http: ws: https://*.supabase.co wss://*.supabase.co https://api.lpuevents.live wss://api.lpuevents.live https://images.lpuevents.live https://lpuevents.live https://*.lpuevents.live wss://*.lpuevents.live https://us.i.posthog.com https://eu.i.posthog.com https://app.posthog.com https://us-assets.i.posthog.com https://*.cloudflareinsights.com https://*.ingest.sentry.io https://*.sentry.io https://*.clarity.ms https://c.bing.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';"
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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), securityHeadersPlugin()],
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
    host: true,
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
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@sentry')) return 'vendor-sentry';
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
