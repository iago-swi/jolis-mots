/**
 * Refait les captures d'écran du README : `npm run captures`, depuis la racine.
 *
 * 1. fabrique l'application (`npm run build`) ;
 * 2. la sert depuis `apps/web/dist` sur un port local libre, le temps du script ;
 * 3. la photographie avec Edge sans fenêtre, piloté par son protocole de débogage :
 *    écran émulé de 390 × 844 px (densité 2) et mode clair imposé ;
 * 4. écrit les images dans `docs/captures/`.
 *
 * Les adresses fixent le mot (`?mot=`) et la palette (`?palette=papier`) ; le mode clair
 * imposé fixe en plus les pastilles « Comme le système » des Réglages, qui suivent le mode
 * sombre de l'appareil. Les images ne dépendent donc ni du hasard du premier mot, ni du
 * mode sombre de la machine. Seul le quiz garde un hasard : ses trois mauvaises réponses.
 * Il s'ouvre sur la séance en cours : avec `?mot=baguenauder#quiz`, il pose la question de ce mot.
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

const serveur = createServer((requete, reponse) => {
  const url = new URL(requete.url ?? '/', 'http://localhost');
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

// Edge sans fenêtre, dans un processus à part (ce script doit rester libre de servir la page).
const navigateur = spawn(edge, [
  '--headless=new',
  '--hide-scrollbars',
  `--user-data-dir=${profil}`,
  '--remote-debugging-port=0',
  'about:blank',
]);
const portDebogage = await new Promise((resolu, rejete) => {
  const minuterie = setTimeout(() => rejete(new Error('Edge ne répond pas')), 30000);
  let texte = '';
  navigateur.stderr.on('data', (d) => {
    texte += d;
    const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(texte);
    if (m) {
      clearTimeout(minuterie);
      resolu(m[1]);
    }
  });
  navigateur.on('error', rejete);
});

/** Ouvre un onglet et rend une fonction `envoyer(méthode, paramètres)` du protocole de débogage. */
async function ouvrirOnglet() {
  const reponse = await fetch(`http://127.0.0.1:${portDebogage}/json/new?about:blank`, { method: 'PUT' });
  const onglet = await reponse.json();
  const socket = new WebSocket(onglet.webSocketDebuggerUrl);
  await new Promise((resolu, rejete) => {
    socket.onopen = resolu;
    socket.onerror = rejete;
  });
  let compteur = 0;
  const attentes = new Map();
  const ecouteurs = [];
  socket.onmessage = (message) => {
    const donnees = JSON.parse(message.data);
    if (donnees.id !== undefined) {
      const attente = attentes.get(donnees.id);
      attentes.delete(donnees.id);
      if (donnees.error) attente?.rejete(new Error(donnees.error.message));
      else attente?.resolu(donnees.result);
    } else {
      ecouteurs.forEach((f) => f(donnees));
    }
  };
  return {
    envoyer: (methode, params = {}) =>
      new Promise((resolu, rejete) => {
        const id = ++compteur;
        attentes.set(id, { resolu, rejete });
        socket.send(JSON.stringify({ id, method: methode, params }));
      }),
    surEvenement: (f) => ecouteurs.push(f),
    fermer: () => socket.close(),
  };
}

const onglet = await ouvrirOnglet();
await onglet.envoyer('Page.enable');
await onglet.envoyer('Emulation.setDeviceMetricsOverride', {
  width: LARGEUR,
  height: HAUTEUR,
  deviceScaleFactor: ECHELLE,
  mobile: false,
});
await onglet.envoyer('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value: 'light' }],
});

/** Charge une adresse de l'application et rend la photo (PNG) quand la page et les polices sont prêtes. */
async function photographier(adresse) {
  const aller = async (url) => {
    const chargee = new Promise((resolu) =>
      onglet.surEvenement((e) => e.method === 'Page.loadEventFired' && resolu()),
    );
    await onglet.envoyer('Page.navigate', { url });
    await chargee;
  };
  // Une adresse qui ne change que le « # » ne recharge pas la page : on passe par about:blank.
  await aller('about:blank');
  await aller(`http://127.0.0.1:${port}/index.html${adresse}`);
  await onglet.envoyer('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
  await new Promise((resolu) => setTimeout(resolu, 800));
  const { data } = await onglet.envoyer('Page.captureScreenshot', { format: 'png' });
  return Buffer.from(data, 'base64');
}

try {
  for (const e of ECRANS) {
    const image = await photographier(e.adresse);
    await sharp(image).png({ compressionLevel: 9 }).toFile(path.join(SORTIE, `${e.nom}.png`));
    console.log(`écrit : docs/captures/${e.nom}.png`);
  }

  // Les quatre palettes de l'écran Mot, côte à côte, chacune à la moitié de la taille de prise.
  const ECART = 24;
  const vignettes = [];
  for (const p of PALETTES) {
    const image = await photographier(`?mot=ceruleen&palette=${p}`);
    vignettes.push(await sharp(image).resize(LARGEUR, HAUTEUR).png().toBuffer());
  }
  await sharp({
    create: {
      width: PALETTES.length * LARGEUR + (PALETTES.length + 1) * ECART,
      height: HAUTEUR + 2 * ECART,
      channels: 3,
      background: '#E4E2DA',
    },
  })
    .composite(vignettes.map((input, i) => ({ input, left: ECART + i * (LARGEUR + ECART), top: ECART })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(SORTIE, 'palettes.png'));
  console.log('écrit : docs/captures/palettes.png');
} finally {
  onglet.fermer();
  const termine = new Promise((resolu) => navigateur.once('close', resolu));
  navigateur.kill();
  await Promise.race([termine, new Promise((resolu) => setTimeout(resolu, 5000))]);
  serveur.close();
  // Edge peut tenir son profil quelques instants encore : un dossier temporaire resté en place n'est pas une erreur.
  try {
    rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    console.warn(`Dossier temporaire non supprimé : ${profil}`);
  }
}
