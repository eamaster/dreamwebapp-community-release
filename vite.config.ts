import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function validateEnvPlugin(): Plugin {
  return {
    name: 'validate-env',
    config(_, { mode }) {
      const isProd = mode === 'production';
      const rawUrl = process.env.VITE_API_BASE_URL;
      if (rawUrl) {
        let parsed: URL;
        try {
          parsed = new URL(rawUrl);
        } catch {
          throw new Error(`[build] Invalid VITE_API_BASE_URL format: "${rawUrl}". Must be a valid URL.`);
        }
        if (parsed.username || parsed.password) {
          throw new Error('[build] VITE_API_BASE_URL must not include credentials.');
        }
        if (parsed.search || parsed.hash) {
          throw new Error('[build] VITE_API_BASE_URL must not contain query parameters or fragments.');
        }
        if (parsed.pathname && parsed.pathname !== '/') {
          throw new Error(`[build] VITE_API_BASE_URL must not include a path component: "${parsed.pathname}".`);
        }
        if (parsed.hostname.endsWith('.workers.dev') || parsed.hostname === 'workers.dev') {
          throw new Error(`[build] Obsolete workers.dev hostname rejected: "${parsed.hostname}".`);
        }
        if (isProd) {
          if (parsed.protocol !== 'https:') {
            throw new Error(`[build] Production API base URL must use HTTPS: "${rawUrl}".`);
          }
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), validateEnvPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  // @ts-expect-error vitest config fields
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
  },
})
