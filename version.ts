import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Le numéro de version vient d'un seul endroit : le package.json racine.
 * La construction de apps/web (et donc l'APK Android, qui l'embarque) le lit
 * ici : l'écran Réglages et la balise <meta name="version"> ne peuvent pas
 * différer. build-apk.mjs lit le même fichier pour versionName et versionCode.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VERSION: string = JSON.parse(
  readFileSync(path.join(HERE, 'package.json'), 'utf8'),
).version;

/** Définit __APP_VERSION__ pour le code de l'application et l'écrit dans index.html. */
export function appVersion(): Plugin {
  return {
    name: 'jolis-mots-version',
    config: () => ({ define: { __APP_VERSION__: JSON.stringify(VERSION) } }),
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { name: 'version', content: VERSION },
        injectTo: 'head',
      },
    ],
  };
}
