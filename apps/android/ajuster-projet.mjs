/**
 * Ajuste le projet Android généré par Capacitor.
 *
 * L'activité principale reste en portrait : `android:screenOrientation="portrait"`
 * est ajouté à `MainActivity` dans `AndroidManifest.xml`, une seule fois. Le dossier
 * `android/` étant généré (et ignoré par git), ce script tourne après chaque
 * `cap sync android`, qui peut réécrire le manifeste.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MANIFESTE = path.join(ICI, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!existsSync(MANIFESTE)) {
  console.error(`Pas de manifeste Android (${MANIFESTE}) : lancer d'abord « npx cap add android ».`);
  process.exit(1);
}

const manifeste = await readFile(MANIFESTE, 'utf8');
const activite = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/;
const balise = manifeste.match(activite);
if (!balise) {
  console.error(`Activité .MainActivity introuvable dans ${MANIFESTE}`);
  process.exit(1);
}

const orientation = /android:screenOrientation="[^"]*"/;
if (balise[0].includes('android:screenOrientation="portrait"')) {
  console.log('manifeste : activité principale déjà en portrait');
} else {
  const ajustee = orientation.test(balise[0])
    ? balise[0].replace(orientation, 'android:screenOrientation="portrait"')
    : balise[0].replace(/<activity\b/, '<activity\n            android:screenOrientation="portrait"');
  await writeFile(MANIFESTE, manifeste.replace(balise[0], ajustee), 'utf8');
  console.log('manifeste : activité principale en portrait');
}
