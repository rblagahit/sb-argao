import { defineConfig } from 'vite';
import path from 'path';

// Vite replaces %VITE_*% tokens in index.html (including inline scripts) at
// build time — Firebase config values never appear in committed source.
// Real values live in .env (gitignored). See .env.example for the template.

export default defineConfig({
  build: {
    outDir:      path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
