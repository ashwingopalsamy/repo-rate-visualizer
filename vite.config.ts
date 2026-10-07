import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: 'es2022', cssCodeSplit: false },
  server: { port: 5180, strictPort: true },
  preview: { port: 4180, strictPort: true },
});
