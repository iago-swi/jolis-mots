/**
 * Refait les captures d'écran du README : `npm run captures`, depuis la racine.
 *
 * 1. fabrique l'application (`npm run build`) ;
 * 2. la sert depuis `apps/web/dist` sur un port local libre, le temps du script ;
 * 3. photographie chaque écran avec Edge sans fenêtre ;
 * 4. écrit les images dans `docs/captures/`.
 *
 * Edge sans fenêtre ne descend pas sous 500 px de large environ. L'application est donc
 * placée dans un cadre de 390 × 844 px (une page d'appoint servie par ce script), puis
 * la photo est rognée à la taille du cadre.
 *
 * Les adresses fixent le mot (`?mot=`) et la palette (`?palette=papier`) pour que les images
 * ne dépendent ni du hasard ni du mode sombre de la machine. Le quiz s'ouvre sur la séance
 * en cours : avec `?mot=baguenauder#quiz`, il pose la question de ce mot.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RACINE, 'apps', 'web', 'dist');
const SORTIE = path.join(RACINE, 'docs', 'captures');

const LARGEUR = 390;
const HAUTEUR = 844;
/** Densité des photos : 2 donne des images nettes sur un écran de téléphone. */
const ECHELLE = 2;

const EDGES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const edge = EDGES.find((e) => existsSync(e));
if (!edge) {
  console.error('Edge est introuvable : ' + EDGES.join(' ou '));
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

/** Les écrans photographiés ; chacun écrit `<nom>.png`. */
const MOT = 'mot=baguenauder&palette=papier';
const ECRANS = [
  { nom: 'mot', adresse: `?${MOT}` },
  { nom: 'quiz', adresse: `?${MOT}#quiz` },
  { nom: 'recueil', adresse: `?${MOT}#recueil` },
  { nom: 'reglages', adresse: `?${MOT}#reglages` },
];
const PALETTES = ['papier', 'nuit', 'ivoire', 'ceruleen'];

console.log('Fabrication de l’application…');
const fabrication = spawnSync('npm run build', { cwd: RACINE, stdio: 'inherit', shell: true });
if (fabrication.status !== 0) process.exit(fabrication.status ?? 1);

/** Page d'appoint : l'application dans un cadre de la taille d'un téléphone. */
function pageDuCadre(adresse) {
  return `<!doctype html><html><head><meta charset='utf-8'><style>
html,body{margin:0;padding:0;background:#888}
iframe{display:block;width:${LARGEUR}px;height:${HAUTEUR}px;border:0}
</style></head><body><iframe src='/index.html${adresse}'></iframe></body></html>`;
}

const serveur = createServer((requete, reponse) => {
  const url = new URL(requete.url ?? '/', 'http://localhost');
  if (url.pathname === '/cadre') {
    reponse.writeHead(200, { 'content-type': TYPES['.html'] });
    reponse.end(pageDuCadre(url.searchParams.get('a') ?? ''));
    return;
  }
  const relatif = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const fichier = path.join(DIST, relatif);
  if (!fichier.startsWith(DIST) || !existsSync(fichier)) {
    reponse.writeHead(404).end();
    return;
  }
  reponse.writeHead(200, { 'content-type': TYPES[path.extname(fichier)] ?? 'application/octet-stream' });
  reponse.end(readFileSync(fichier));
});
await new Promise((resolu) => serveur.listen(0, '127.0.0.1', resolu));
const port = serveur.address().port;
console.log(`Application servie sur http://127.0.0.1:${port}`);

const profil = mkdtempSync(path.join(tmpdir(), 'jolis-mots-captures-'));
mkdirSync(SORTIE, { recursive: true });

/** Photographie une adresse de l'application et rend l'image rognée à la taille du téléphone. */
async function photographier(adresse) {
  const brut = path.join(profil, `brut-${Date.now()}.png`);
  const cadre = `http://127.0.0.1:${port}/cadre?a=${encodeURIComponent(adresse)}`;
  // Edge tourne dans un processus à part, sans bloquer ce script : celui-ci doit rester libre de servir la page.
  const stderr = await new Promise((resolu, rejete) => {
    const edgeProcess = spawn(edge, [
      '--headless=new',
      '--hide-scrollbars',
      `--user-data-dir=${profil}`,
      `--force-device-scale-factor=${ECHELLE}`,
      '--virtual-time-budget=6000',
      '--window-size=700,1000',
      `--screenshot=${brut}`,
      cadre,
    ]);
    let erreurs = '';
    edgeProcess.stderr.on('data', (d) => (erreurs += d));
    const minuterie = setTimeout(() => edgeProcess.kill(), 60000);
    edgeProcess.on('error', rejete);
    edgeProcess.on('close', () => {
      clearTimeout(minuterie);
      resolu(erreurs);
    });
  });
  if (!existsSync(brut)) throw new Error(`Pas d'image pour ${adresse} : ${stderr}`);
  return sharp(brut)
    .extract({ left: 0, top: 0, width: LARGEUR * ECHELLE, height: HAUTEUR * ECHELLE })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

try {
  for (const e of ECRANS) {
    const image = await photographier(e.adresse);
    await sharp(image).toFile(path.join(SORTIE, `${e.nom}.png`));
    console.log(`écrit : docs/captures/${e.nom}.png`);
  }

  // Les quatre palettes de l'écran Mot, côte à côte, chacune à la moitié de la taille de prise.
  const ECART = 24;
  const l = LARGEUR;
  const h = HAUTEUR;
  const vignettes = [];
  for (const p of PALETTES) {
    const image = await photographier(`?mot=ceruleen&palette=${p}`);
    vignettes.push(await sharp(image).resize(l, h).png().toBuffer());
  }
  await sharp({
    create: {
      width: PALETTES.length * l + (PALETTES.length + 1) * ECART,
      height: h + 2 * ECART,
      channels: 3,
      background: '#E4E2DA',
    },
  })
    .composite(vignettes.map((input, i) => ({ input, left: ECART + i * (l + ECART), top: ECART })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(SORTIE, 'palettes.png'));
  console.log('écrit : docs/captures/palettes.png');
} finally {
  serveur.close();
  rmSync(profil, { recursive: true, force: true });
}
