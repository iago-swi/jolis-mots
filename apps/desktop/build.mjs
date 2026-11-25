/**
 * Assemble le processus principal d'Electron et son preload.
 *
 * Les paquets de l'espace de travail sont du TypeScript sans étape de fabrication ;
 * Electron, lui, exécute du JavaScript. esbuild fait donc de `main.ts` (avec `depot.ts`)
 * et de `preload.ts` deux fichiers CommonJS, `electron` restant fourni par le programme.
 * La page (`apps/web/dist`) est copiée à côté, dans `dist/web`, avec l'icône.
 *
 * Lancer après `npm run build` : npm run build -w @jolis-mots/desktop
 */
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..', '..');
const SORTIE = path.join(ICI, 'dist');
const PAGE = path.join(RACINE, 'apps', 'web', 'dist');

if (!existsSync(PAGE)) {
  console.error('apps/web/dist manque : lancer d’abord « npm run build ».');
  process.exit(1);
}

await rm(SORTIE, { recursive: true, force: true });
await mkdir(SORTIE, { recursive: true });

const commun = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  logLevel: 'info',
};

await build({ ...commun, entryPoints: [path.join(ICI, 'src', 'main.ts')], outfile: path.join(SORTIE, 'main.cjs') });
await build({ ...commun, entryPoints: [path.join(ICI, 'src', 'preload.ts')], outfile: path.join(SORTIE, 'preload.cjs') });

await cp(PAGE, path.join(SORTIE, 'web'), { recursive: true });

// Installée, l'application prend l'icône de l'exécutable ; lancée d'ici, la fenêtre la reçoit à part.
await cp(path.join(ICI, 'assets', 'icon.png'), path.join(SORTIE, 'icon.png'));

console.log('bureau assemblé : apps/desktop/dist (main.cjs, preload.cjs, web/)');
