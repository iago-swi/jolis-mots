import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { appVersion } from '../../version.ts';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [svelte(), appVersion()],
  // Chemins relatifs : l'application s'ouvre aussi bien d'un serveur que d'un fichier embarqué.
  base: './',
  server: {
    port: 5173,
    // La liste embarquée vient de donnees/, hors de apps/web.
    fs: { allow: [RACINE] },
  },
  // La liste embarquée (plus de 700 ko) est dans le paquet : l'application la lit sans réseau.
  build: { chunkSizeWarningLimit: 1500 },
  // Le cœur est livré en TypeScript : Vite le transforme comme le code de l'application.
  optimizeDeps: { exclude: ['@jolis-mots/core'] },
});
