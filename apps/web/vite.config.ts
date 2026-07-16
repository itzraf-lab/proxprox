import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Dev server port for the frontend (default 5173).
const port = Number(process.env.PORT ?? '5173');

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

// Public base path the app is served under (default "/").
const basePath = process.env.BASE_PATH ?? '/';

// Where the Express API server listens. In dev we proxy /api and /v1 to it so
// the browser stays same-origin (no CORS, no VITE_API_URL needed).
const apiTarget = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? '8080'}`;

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    // In Replit the app is served through a TLS proxy, so the HMR WebSocket
    // must connect to the external domain over WSS:443 — not ws://localhost —
    // or the socket drops repeatedly and Vite falls back to full-page reloads.
    hmr: process.env.REPLIT_DEV_DOMAIN
      ? {
          host: process.env.REPLIT_DEV_DOMAIN,
          protocol: 'wss',
          clientPort: 443,
        }
      : true,
    fs: {
      strict: true,
    },
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/v1': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
