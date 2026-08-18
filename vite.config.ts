import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lpu-events/shared': path.resolve(__dirname, './src/shared')
    }
  },
  server: {
    port: 3001,
    strictPort: true,
    host: true
  }
});
