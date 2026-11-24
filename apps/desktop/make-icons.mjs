/**
 * Tire les icônes Windows du dessin de l'application, `apps/android/assets/icone.svg`
 * (les lettres « jm » sur fond papier, écrit par le `make-icons.mjs` d'Android).
 *
 * - `assets/icon.png` : 512 px, l'icône de la fenêtre quand l'application n'est pas installée ;
 * - `assets/icon.ico` : toutes les tailles que Windows peut demander, pour l'exécutable.
 *
 * Lancer avec : npm run icons -w @jolis-mots/desktop
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(ICI, 'assets');
const SVG = path.join(ICI, '..', 'android', 'assets', 'icone.svg');

const TAILLES_ICO = [16, 24, 32, 48, 64, 128, 256];

const dessin = await readFile(SVG);

const rendre = (taille) =>
  sharp(dessin, { density: 384 })
    .resize(taille, taille, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();

await mkdir(ASSETS, { recursive: true });
await writeFile(path.join(ASSETS, 'icon.png'), await rendre(512));
await writeFile(path.join(ASSETS, 'icon.ico'), await pngToIco(await Promise.all(TAILLES_ICO.map(rendre))));

console.log(`icônes écrites : icon.png (512), icon.ico (${TAILLES_ICO.join(', ')})`);
