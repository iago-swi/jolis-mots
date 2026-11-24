import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Le greffon compile les fichiers `.svelte.ts` (runes) ; la condition `browser`
  // charge la version de Svelte pour le navigateur, où `$state` et `$derived` réagissent.
  // Même configuration Svelte que l'application.
  plugins: [svelte({ configFile: 'apps/web/svelte.config.js' })],
  resolve: { conditions: ['browser'] },
  test: {
    // Les deux racines : packages/core porte la logique et ses tests, apps/web
    // quelques tests de l'application (barres.test.ts, etat.test.ts). Un motif limité à
    // packages/ ignorerait ceux-ci sans rien dire.
    include: ['{packages,apps}/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
});
