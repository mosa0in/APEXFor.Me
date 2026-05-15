import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // API key removed from client bundle for security
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // Anthropic AI proxy (for coach)
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        },
        // Future FastAPI backend proxy
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
      // Serve backend data directory as static files
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
        ],
      },
    },
  };
});
