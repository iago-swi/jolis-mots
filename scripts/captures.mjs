/**
 * Refait les captures d'écran du README : `npm run captures`, depuis la racine.
 *
 * 1. fabrique l'application (`npm run build`) ;
 * 2. la sert depuis `apps/web/dist` sur un port local libre, le temps du script ;
 * 3. la photographie avec Edge sans fenêtre, piloté par son protocole de débogage :
 *    écran émulé de 411 × 890 px (densité 2), la largeur du téléphone de Philippe, 1280 × 800
 *    pour l'atelier, et mode clair imposé ;
 * 4. écrit les images dans `docs/captures/`.
 *
 * Avant les photos, il contrôle que les filtres du Recueil tiennent sur une seule ligne
 * d'un écran de 411 px de large (le téléphone de Philippe), et s'arrête sinon.
 *
 * Les adresses fixent le mot (`?mot=`) et la palette (`?palette=papier`) ; le mode clair
 * imposé fixe en plus les pastilles « Comme le système » des Réglages, qui suivent le mode
 * sombre de l'appareil. Les images ne dépendent donc ni du hasard du premier mot, ni du
 * mode sombre de la machine. Seul le quiz garde un hasard : ses trois mauvaises réponses.
 *
 * `quiz.png` montre le choix du quiz. `question.png` saute ce choix (`?quiz=vus`) : le seul
 * mot vu jusque-là étant « Baguenauder », la question porte sur lui. `atelier.png` est prise
 * à 1280 × 800 avec le pont de démonstration (`?pont=demo#atelier`) ; aucune adresse n'ouvre
 * un mot dans l'atelier, le script touche donc la ligne « Vénuste » de la liste.
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

/** Le téléphone de Philippe : à 390 px, le dernier filtre du Recueil sortirait de l'image. */
const LARGEUR = 411;
const HAUTEUR = 890;
/** L'atelier, sur un écran de bureau, photographié à sa taille (densité 1). */
const ATELIER = { largeur: 1280, hauteur: 800, mot: 'Vénuste' };
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
  { nom: 'question', adresse: `?quiz=vus&${MOT}#quiz` },
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
await onglet.envoyer('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value: 'light' }],
});

/** Émule un écran de la largeur et de la hauteur données (en px CSS). */
async function emuler(largeur, hauteur, echelle = ECHELLE) {
  await onglet.envoyer('Emulation.setDeviceMetricsOverride', {
    width: largeur,
    height: hauteur,
    deviceScaleFactor: echelle,
    mobile: false,
  });
}

/** Charge une adresse de l'application et attend que la page et les polices soient prêtes. */
async function charger(adresse) {
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
}

/** Rend la photo (PNG) de la page affichée. */
async function photo() {
  const { data } = await onglet.envoyer('Page.captureScreenshot', { format: 'png' });
  return Buffer.from(data, 'base64');
}

/** Charge une adresse de l'application et rend la photo (PNG). */
async function photographier(adresse) {
  await charger(adresse);
  return photo();
}

/** L'atelier avec le pont de démonstration, le mot `ATELIER.mot` ouvert dans la fiche. */
async function photographierAtelier() {
  await emuler(ATELIER.largeur, ATELIER.hauteur, 1);
  await charger('?pont=demo&palette=papier#atelier');
  const { result } = await onglet.envoyer('Runtime.evaluate', {
    expression: `(() => {
      const ligne = [...document.querySelectorAll('.liste-mots ul button')].find(
        (b) => b.querySelector('.mot')?.textContent === ${JSON.stringify(ATELIER.mot)},
      );
      if (ligne === undefined) return false;
      ligne.scrollIntoView({ block: 'center' });
      ligne.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (result.value !== true) throw new Error(`« ${ATELIER.mot} » introuvable dans la liste de l’atelier.`);
  await new Promise((resolu) => setTimeout(resolu, 800));
  const ouvert = await onglet.envoyer('Runtime.evaluate', {
    expression: 'document.getElementById("f-mot")?.value',
    returnByValue: true,
  });
  if (ouvert.result.value !== ATELIER.mot) throw new Error(`La fiche de « ${ATELIER.mot} » ne s’est pas ouverte.`);
  return photo();
}

/** Vrai si les filtres du Recueil tiennent sur une ligne, sans défilement, à 411 px de large. */
async function filtresSurUneLigne() {
  await emuler(411, 900);
  await charger(`?${MOT}#recueil`);
  const { result } = await onglet.envoyer('Runtime.evaluate', {
    expression: `(() => {
      const filtres = document.querySelector('.filtres');
      if (filtres === null) return false;
      const boutons = [...filtres.querySelectorAll('button')];
      const haut = boutons[0]?.getBoundingClientRect().top;
      return filtres.scrollWidth <= filtres.clientWidth && boutons.every((b) => b.getBoundingClientRect().top === haut);
    })()`,
    returnByValue: true,
  });
  return result.value === true;
}

try {
  if (!(await filtresSurUneLigne())) {
    console.error('Les filtres du Recueil ne tiennent pas sur une ligne à 411 px.');
    process.exitCode = 1;
  } else {
    console.log('Filtres du Recueil : une ligne à 411 px.');
    await emuler(LARGEUR, HAUTEUR);
    for (const e of ECRANS) {
      const image = await photographier(e.adresse);
      await sharp(image).png({ compressionLevel: 9 }).toFile(path.join(SORTIE, `${e.nom}.png`));
      console.log(`écrit : docs/captures/${e.nom}.png`);
    }

    await sharp(await photographierAtelier()).png({ compressionLevel: 9 }).toFile(path.join(SORTIE, 'atelier.png'));
    console.log('écrit : docs/captures/atelier.png');
    await emuler(LARGEUR, HAUTEUR);

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
  }
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
