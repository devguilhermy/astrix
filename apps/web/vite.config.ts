import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    {
      name: 'astrix-static-recovery',
      transformIndexHtml(html, context) {
        if (!context.filename.endsWith('/404.html')) return html;
        const styles = readFileSync(resolve(import.meta.dirname, 'src/startup.css'), 'utf8')
          + readFileSync(resolve(import.meta.dirname, 'src/ui/recovery/recovery.css'), 'utf8');
        // A self-contained error document also works when a host serves it at a missing nested URL.
        return html.replace('__ASTRIX_RECOVERY_STYLES__', styles).replace('__ASTRIX_HOME_URL__', '/#home');
      },
    },
  ],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), notFound: resolve(import.meta.dirname, '404.html') },
      output: { manualChunks: { three: ['three', '@react-three/fiber'], react: ['react', 'react-dom'] } },
    },
  },
});
