import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          d3: ['d3'],
          'shadcn-vendors': ['radix-ui', 'cmdk', 'vaul', 'lucide-react'],
        },
      },
    },
  },
});
