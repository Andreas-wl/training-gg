import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages-projektsida (https://andreas-wl.github.io/training-gg/),
  // inte en användarsida på roten - alla asset-sökvägar måste vara
  // prefixade med undermappen.
  base: '/training-gg/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Manifest hanteras fristående i public/manifest.json (redan länkad
      // via <link rel="manifest"> i index.html), så vi låter inte pluginet
      // generera ett eget manifest – det skulle ge dubbla/motstridiga manifest.
      manifest: false,
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
      },
    }),
  ],
});
