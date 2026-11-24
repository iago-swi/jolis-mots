import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * The version a player sees comes from one place: the workspace package.json.
 * Every build that renders the app (web, single file, and through them the
 * desktop and Android shells) reads it from here, so the title screen, the
 * page's <meta name="version"> and the artifact names cannot disagree.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VERSION: string = JSON.parse(
  readFileSync(path.join(HERE, 'package.json'), 'utf8'),
).version;

/** Defines __APP_VERSION__ for the app code and declares it in index.html. */
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
