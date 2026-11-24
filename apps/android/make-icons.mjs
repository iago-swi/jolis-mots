/**
 * Dessine l'icône de l'application et en tire les icônes Android.
 *
 * Les lettres « jm » sont les vrais glyphes d'EB Garamond italique, lus dans la
 * police que l'application embarque déjà (`@fontsource/eb-garamond`) et changés
 * en tracés : un `<text>` dépendrait d'une police installée sur la machine, et
 * sharp prendrait sans le dire un autre empattement à sa place.
 *
 * Le dessin est écrit dans `assets/icone.svg` (gardé dans le dépôt, sur fond
 * papier), puis rendu en trois jeux :
 *
 * - `ic_launcher_foreground` : la couche de l'icône adaptative, transparente, à
 *   108 dp. Le lanceur la découpe et la fait bouger : le dessin tient dans le
 *   cercle central de 66 dp.
 * - `ic_launcher` / `ic_launcher_round` : les anciennes icônes de 48 dp, fond
 *   compris, cadrées sur la partie visible d'une icône adaptative.
 * - la couleur de fond, que l'icône adaptative pose sous la couche.
 *
 * Il réécrit aussi l'écran de lancement : chaque `splash.png` que Capacitor a
 * créé (`drawable*`, `drawable-night*`) devient un fond papier avec la marque
 * « jm » au centre, large d'un quart du petit côté, aux mêmes dimensions que
 * l'image remplacée. Et le thème de lancement d'Android 12 et plus reçoit le
 * même fond papier. Le fond de la fenêtre de l'application devient le papier
 * de Papier le jour et celui de Nuit en mode sombre. Le dossier `android/` étant généré, un nouveau
 * `npx cap add android` suivi de ce script redonne le même résultat.
 */
import sharp from 'sharp';
import opentype from 'opentype.js';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RES = path.join(ICI, 'android', 'app', 'src', 'main', 'res');
const SVG = path.join(ICI, 'assets', 'icone.svg');

const PAPIER = '#F3F4EF';
const ENCRE = '#1A2230';
const VERMILLON = '#B8321E';

/** Canevas d'une icône adaptative (dp) et diamètre du cercle toujours visible. */
const CANEVAS = 108;
const ZONE_SURE = 66;
/** Marge gardée à l'intérieur du cercle sûr. */
const DIAGONALE = ZONE_SURE - 2;
/** Largeur du contour papier autour des lettres (dp), qui coupe le filet sous la queue du j. */
const HALO = 2.4;

/** Paliers de densité : ancienne icône à 48 dp, couches adaptatives à 108 dp. */
const DENSITES = [
  { dir: 'mdpi', ancienne: 48, adaptative: 108 },
  { dir: 'hdpi', ancienne: 72, adaptative: 162 },
  { dir: 'xhdpi', ancienne: 96, adaptative: 216 },
  { dir: 'xxhdpi', ancienne: 144, adaptative: 324 },
  { dir: 'xxxhdpi', ancienne: 192, adaptative: 432 },
];

const require = createRequire(import.meta.url);
const fichierPolice = require.resolve(
  '@fontsource/eb-garamond/files/eb-garamond-latin-500-italic.woff',
);

/**
 * Abscisse (dp) où se termine, en partant de la gauche, le premier passage d'encre
 * sur la ligne `y` : la queue du j. Lue sur un rendu des lettres seules, dix pixels par dp.
 */
async function finDeLaQueue(lettres, y) {
  const PAR_DP = 10;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANEVAS} ${CANEVAS}" width="${CANEVAS * PAR_DP}" height="${CANEVAS * PAR_DP}"><path d="${lettres}" fill="#000"/></svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ligne = Math.round(y * PAR_DP);
  const encre = (x) => data[(ligne * info.width + x) * info.channels + 3] > 127;
  let x = 0;
  while (x < info.width && !encre(x)) x += 1;
  while (x < info.width && encre(x)) x += 1;
  if (x >= info.width) throw new Error('la queue du j ne croise pas le filet');
  return x / PAR_DP;
}

/** Dessine « jm » souligné ; rend le SVG complet (fond papier) et la seule couche de premier plan. */
async function dessiner() {
  const octets = await readFile(fichierPolice);
  const police = opentype.parse(
    octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength),
  );

  // Mesure à la taille 100, ligne de base en y = 0.
  const mesure = police.getPath('jm', 0, 0, 100).getBoundingBox();
  const filet = { dessous: 9, epaisseur: 5.5 }; // sous la ligne de base, en unités de la taille 100
  const haut = mesure.y1;
  const bas = Math.max(mesure.y2, filet.dessous + filet.epaisseur);
  const largeur = mesure.x2 - mesure.x1;
  const hauteur = bas - haut;

  // Agrandi jusqu'à ce que la diagonale du dessin tienne dans le cercle sûr.
  const echelle = DIAGONALE / Math.hypot(largeur, hauteur);
  const taille = 100 * echelle;
  const x0 = CANEVAS / 2 - (mesure.x1 + largeur / 2) * echelle;
  const y0 = CANEVAS / 2 - (haut + hauteur / 2) * echelle;

  const lettres = police.getPath('jm', x0, y0, taille).toPathData(2);
  const r = (n) => Math.round(n * 100) / 100;
  const y = y0 + filet.dessous * echelle;
  const h = filet.epaisseur * echelle;
  // Le filet part de la queue du j, qui le croise : sans cela un bout de trait dépasse à gauche.
  const debut = await finDeLaQueue(lettres, y + h / 2);
  const fin = x0 + mesure.x2 * echelle;
  const trait = { x: r(debut), y: r(y), l: r(fin - debut), h: r(h) };
  // Le contour papier des lettres détache le filet de la queue du j.
  const premierPlan = [
    `<rect x="${trait.x}" y="${trait.y}" width="${trait.l}" height="${trait.h}" fill="${VERMILLON}"/>`,
    `<path d="${lettres}" fill="${ENCRE}" stroke="${PAPIER}" stroke-width="${HALO}" stroke-linejoin="round" paint-order="stroke"/>`,
  ].join('\n  ');
  const ouvrir = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANEVAS} ${CANEVAS}" width="${CANEVAS}" height="${CANEVAS}">`;
  return {
    complet: `${ouvrir}\n  <rect width="${CANEVAS}" height="${CANEVAS}" fill="${PAPIER}"/>\n  ${premierPlan}\n</svg>\n`,
    premierPlan: `${ouvrir}\n  ${premierPlan}\n</svg>\n`,
    /** Largeur du dessin (dp), queue du j comprise. */
    largeur: largeur * echelle,
  };
}

const rendre = (svg, taille) =>
  sharp(Buffer.from(svg), { density: 384 })
    .resize(taille, taille, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

/** L'ancienne icône montre la partie visible d'une icône adaptative (72 dp sur 108), pas tout le canevas. */
function cadrer(svg) {
  const marge = (CANEVAS - 72) / 2;
  return svg.replace(`viewBox="0 0 ${CANEVAS} ${CANEVAS}"`, `viewBox="${marge} ${marge} 72 72"`);
}

const { complet, premierPlan, largeur } = await dessiner();
await writeFile(SVG, complet, 'utf8');
console.log(`dessin écrit : ${path.relative(process.cwd(), SVG)}`);

/** Écran de lancement : fond papier, la marque au centre, large d'un quart du petit côté. */
async function ecranDeLancement(l, h) {
  const cote = Math.round(((Math.min(l, h) / 4) * CANEVAS) / largeur);
  return sharp({ create: { width: l, height: h, channels: 3, background: PAPIER } })
    .composite([{ input: await rendre(premierPlan, cote), gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** `--apercu <fichier>` : l'icône en 512 px ; `--apercu-accueil <fichier>` : l'écran de lancement en 1080 × 1920. */
async function apercu(option, fabriquer) {
  const i = process.argv.indexOf(option);
  if (i === -1) return;
  const cible = process.argv[i + 1];
  await mkdir(path.dirname(cible), { recursive: true });
  await writeFile(cible, await fabriquer());
  console.log(`aperçu écrit : ${cible}`);
}
await apercu('--apercu', () => rendre(complet, 512));
await apercu('--apercu-accueil', () => ecranDeLancement(1080, 1920));

if (!existsSync(RES)) {
  console.error(`Pas de projet Android dans ${RES} : lancer d'abord « npx cap add android ».`);
  process.exit(1);
}

for (const { dir, ancienne, adaptative } of DENSITES) {
  const sortie = path.join(RES, `mipmap-${dir}`);
  await mkdir(sortie, { recursive: true });
  const carre = await rendre(cadrer(complet), ancienne);
  await writeFile(path.join(sortie, 'ic_launcher.png'), carre);
  await writeFile(path.join(sortie, 'ic_launcher_round.png'), carre);
  await writeFile(path.join(sortie, 'ic_launcher_foreground.png'), await rendre(premierPlan, adaptative));
}

await writeFile(
  path.join(RES, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${PAPIER}</color>\n</resources>\n`,
  'utf8',
);

console.log(
  `icônes Android écrites pour ${DENSITES.map((d) => d.dir).join(', ')} ; fond adaptatif ${PAPIER}`,
);

// Chaque image de lancement créée par Capacitor est remplacée, à ses dimensions.
const dossiers = (await readdir(RES)).filter((d) => d.startsWith('drawable'));
let remplacees = 0;
for (const dossier of dossiers) {
  const fichier = path.join(RES, dossier, 'splash.png');
  if (!existsSync(fichier)) continue;
  const { width, height } = await sharp(fichier).metadata();
  await writeFile(fichier, await ecranDeLancement(width, height));
  remplacees += 1;
}
if (remplacees === 0) {
  console.error(`Aucune image de lancement (splash.png) dans ${RES}/drawable*`);
  process.exit(1);
}

// Android 12 et plus dessinent leur propre écran de lancement : même fond papier.
const styles = path.join(RES, 'values', 'styles.xml');
const theme = await readFile(styles, 'utf8');
const fond = '<item name="windowSplashScreenBackground">@color/ic_launcher_background</item>';
if (!theme.includes(fond)) {
  const lancement = /(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/;
  if (!lancement.test(theme)) {
    console.error(`Thème AppTheme.NoActionBarLaunch introuvable dans ${styles}`);
    process.exit(1);
  }
  await writeFile(styles, theme.replace(lancement, `$1\n        ${fond}`), 'utf8');
}

console.log(`écran de lancement écrit : ${remplacees} images, fond ${PAPIER}`);

// Fond de la fenêtre : sur une WebView d'avant Chromium 140, Capacitor décale la page sous les
// barres du système, qui restent posées sur ce fond. Il prend le papier de Papier le jour et celui
// de Nuit en mode sombre, comme « Comme le système ».
const NUIT = '#14181F';
for (const [dossier, couleur] of [
  ['values', PAPIER],
  ['values-night', NUIT],
]) {
  await mkdir(path.join(RES, dossier), { recursive: true });
  await writeFile(
    path.join(RES, dossier, 'fond_fenetre.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="fond_fenetre">${couleur}</color>\n</resources>\n`,
    'utf8',
  );
}
const themeApp = await readFile(styles, 'utf8');
const fondFenetre = '<item name="android:windowBackground">@color/fond_fenetre</item>';
if (!themeApp.includes(fondFenetre)) {
  const application = /(<style name="AppTheme\.NoActionBar" [^>]*>)/;
  if (!application.test(themeApp)) {
    console.error(`Thème AppTheme.NoActionBar introuvable dans ${styles}`);
    process.exit(1);
  }
  await writeFile(styles, themeApp.replace(application, `$1\n        ${fondFenetre}`), 'utf8');
}
console.log(`fond de la fenêtre : ${PAPIER} le jour, ${NUIT} en mode sombre`);
