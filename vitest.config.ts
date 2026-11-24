import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Les deux racines : packages/core porte la logique et ses tests, apps/web
    // quelques tests de l'application (barres.test.ts). Un motif limité à
    // packages/ ignorerait ceux-ci sans rien dire.
    include: ['{packages,apps}/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
});
