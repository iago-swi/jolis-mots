// Le processus principal d'Electron, pour Windows. Il ouvre la page de l'application
// (`dist/web/index.html`, sans serveur) et lui donne, par le preload, le pont vers la copie
// locale des mots : tout le travail git passe par `depot.ts`.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  screen,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { ADRESSE_DEPOT, enregistrer, envoyer, ouvrir, reprendre, synchroniser, type Depot } from './depot';

// Une version de développement ne travaille jamais sur les vraies données : sans dossier de
// données à part, elle s'arrête avant d'ouvrir une fenêtre ou de créer un dossier.
if (!app.isPackaged && !process.env.JOLISMOTS_DONNEES) {
  console.error(
    [
      'Jolis Mots ne démarre pas en développement sans JOLISMOTS_DONNEES.',
      'Sans elle, l’application travaillerait sur la vraie copie de la liste, dans %APPDATA%\\Jolis Mots,',
      'à un clic de la branche donnees en ligne. Donner les deux variables\u202F:',
      '  JOLISMOTS_DEPOT\u202F: l’adresse du dépôt de la liste pour l’essai, par exemple un dépôt nu local\u202F;',
      '  JOLISMOTS_DONNEES\u202F: un dossier de données à part (copie, sauvegardes, fenêtre).',
      'Un exemple est dans PROJET.md, «\u202FMettre en route après un clonage\u202F».',
    ].join('\n'),
  );
  process.exit(1);
}

// Avant tout le reste : le dossier des données décide aussi du verrou d'instance unique.
if (process.env.JOLISMOTS_DONNEES) app.setPath('userData', process.env.JOLISMOTS_DONNEES);

const depot: Depot = {
  dossier: path.join(app.getPath('userData'), 'donnees'),
  sauvegardes: path.join(app.getPath('userData'), 'sauvegardes'),
  adresse: process.env.JOLISMOTS_DEPOT ?? ADRESSE_DEPOT,
};

/** Seules adresses que « Ouvrir dans le CNRTL » peut ouvrir dans le navigateur. */
const PREFIXE_CNRTL = 'https://www.cnrtl.fr/definition/';

const FICHIER_FENETRE = 'fenetre.json';
const LARGEUR_MIN = 960;
const HAUTEUR_MIN = 640;
const LARGEUR_SOUHAITEE = 1280;
const HAUTEUR_SOUHAITEE = 820;
/** Marge laissée autour de la fenêtre au premier lancement. */
const MARGE_ECRAN = 60;

/** Le papier de Nuit et celui de Papier : pas d'éclair blanc avant que la page se peigne. */
const FOND_SOMBRE = '#14181F';
const FOND_CLAIR = '#F3F4EF';

const PAGE = path.join(__dirname, 'web', 'index.html');
const ADRESSE_PAGE = pathToFileURL(PAGE).href;

let fenetre: BrowserWindow | undefined;
/** Vrai quand l'atelier tient une fiche modifiée et pas encore enregistrée. */
let ficheModifiee = false;
/** Vrai pendant qu'une question (quitter, recharger) attend sa réponse. */
let questionPosee = false;
/** Vrai après « Quitter » : la fermeture qui suit ne repose pas la question. */
let quitterQuandMeme = false;

interface EtatFenetre {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

function cheminEtatFenetre(): string {
  return path.join(app.getPath('userData'), FICHIER_FENETRE);
}

/** La taille et la place retenues, ramenées à l'écran : jamais plus grande que la zone de travail. */
function lireEtatFenetre(): EtatFenetre {
  const { width: dispoL, height: dispoH } = screen.getPrimaryDisplay().workAreaSize;
  const maxL = Math.max(LARGEUR_MIN, dispoL - MARGE_ECRAN);
  const maxH = Math.max(HAUTEUR_MIN, dispoH - MARGE_ECRAN);
  const borner = (v: number, min: number, max: number) => Math.round(Math.min(Math.max(v, min), max));
  const defaut: EtatFenetre = {
    width: borner(LARGEUR_SOUHAITEE, LARGEUR_MIN, maxL),
    height: borner(HAUTEUR_SOUHAITEE, HAUTEUR_MIN, maxH),
  };
  try {
    const retenu = JSON.parse(readFileSync(cheminEtatFenetre(), 'utf8')) as Partial<EtatFenetre>;
    const etat: EtatFenetre = {
      width: borner(retenu.width ?? defaut.width, LARGEUR_MIN, maxL),
      height: borner(retenu.height ?? defaut.height, HAUTEUR_MIN, maxH),
      maximized: retenu.maximized,
    };
    // Une place sur un écran débranché depuis est oubliée : la fenêtre s'ouvre centrée.
    if (typeof retenu.x === 'number' && typeof retenu.y === 'number') {
      const place = { x: retenu.x, y: retenu.y, width: etat.width, height: etat.height };
      if (screen.getAllDisplays().some((e) => seCroisent(place, e.workArea))) {
        etat.x = retenu.x;
        etat.y = retenu.y;
      }
    }
    return etat;
  } catch {
    return defaut;
  }
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Vrai si les deux rectangles ont une surface en commun. */
function seCroisent(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function retenirEtatFenetre(): void {
  if (!fenetre || fenetre.isDestroyed()) return;
  const b = fenetre.getNormalBounds();
  const etat: EtatFenetre = { width: b.width, height: b.height, x: b.x, y: b.y, maximized: fenetre.isMaximized() };
  try {
    writeFileSync(cheminEtatFenetre(), JSON.stringify(etat), 'utf8');
  } catch {
    // Retenir la fenêtre est une commodité : un échec ne doit rien empêcher.
  }
}

function poserMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Jolis Mots',
        submenu: [
          // Pas le rôle « reload » : recharger abandonne la fiche, la question passe d'abord.
          { label: 'Recharger', accelerator: 'CmdOrCtrl+R', click: () => recharger() },
          { role: 'toggleDevTools', label: 'Outils de développement' },
          { type: 'separator' },
          { role: 'quit', label: 'Quitter' },
        ],
      },
      {
        label: 'Affichage',
        submenu: [
          { role: 'resetZoom', label: 'Taille réelle' },
          { role: 'zoomIn', label: 'Zoom avant' },
          { role: 'zoomOut', label: 'Zoom arrière' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Plein écran' },
        ],
      },
    ]),
  );
}

/** Vrai si la demande vient de la page de la fenêtre, et de nulle part ailleurs. */
function vientDeLaPage(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return fenetre !== undefined && !fenetre.isDestroyed() && e.sender === fenetre.webContents;
}

/** Vrai si l'adresse est celle de la page, au « # » près. */
function estLaPage(adresse: string): boolean {
  try {
    const u = new URL(adresse);
    u.hash = '';
    return u.href === ADRESSE_PAGE;
  } catch {
    return false;
  }
}

/**
 * Les canaux du pont. Les arguments viennent de la page : leur type est vérifié ici,
 * et une demande mal formée est ignorée.
 */
function brancherPont(): void {
  ipcMain.handle('depot:ouvrir', (e) => (vientDeLaPage(e) ? ouvrir(depot) : undefined));
  ipcMain.handle('depot:synchroniser', (e) => (vientDeLaPage(e) ? synchroniser(depot) : undefined));
  ipcMain.handle('depot:enregistrer', (e, texte: unknown) =>
    vientDeLaPage(e) && typeof texte === 'string' ? enregistrer(depot, texte) : undefined,
  );
  ipcMain.handle('depot:envoyer', (e, texte: unknown, message: unknown) =>
    vientDeLaPage(e) && typeof texte === 'string' && typeof message === 'string'
      ? envoyer(depot, texte, message)
      : undefined,
  );
  ipcMain.handle('depot:reprendre', (e) => (vientDeLaPage(e) ? reprendre(depot, new Date()) : undefined));
  ipcMain.handle('cnrtl:ouvrir', async (e, adresse: unknown) => {
    if (vientDeLaPage(e) && typeof adresse === 'string' && adresse.startsWith(PREFIXE_CNRTL)) {
      await shell.openExternal(adresse);
    }
  });
  ipcMain.on('fiche:modifiee', (e, modifiee: unknown) => {
    if (vientDeLaPage(e) && typeof modifiee === 'boolean') ficheModifiee = modifiee;
  });
}

/**
 * Fiche modifiée : pose la question (« Annuler » par défaut) et ne fait `action` qu'après
 * le bouton `bouton`. Une seule question à la fois.
 */
function demanderPuis(f: BrowserWindow, question: string, bouton: string, action: () => void): void {
  if (questionPosee) return;
  questionPosee = true;
  void dialog
    .showMessageBox(f, {
      type: 'question',
      title: 'Jolis Mots',
      message: question,
      buttons: [bouton, 'Annuler'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    })
    .then(({ response }) => {
      if (response === 0 && !f.isDestroyed()) action();
    })
    .catch(() => undefined)
    .finally(() => {
      questionPosee = false;
    });
}

/** Fiche modifiée : la fenêtre ne se ferme qu'après « Quitter ». */
function demanderAvantDeFermer(f: BrowserWindow): void {
  demanderPuis(f, 'Quitter sans enregistrer la fiche\u202F?', 'Quitter', () => {
    quitterQuandMeme = true;
    f.close();
  });
}

/** Recharge la page ; une fiche modifiée n'est abandonnée qu'après « Recharger ». */
function recharger(): void {
  const f = fenetre;
  if (!f || f.isDestroyed()) return;
  if (!ficheModifiee) {
    f.webContents.reload();
    return;
  }
  demanderPuis(f, 'Recharger sans enregistrer la fiche\u202F?', 'Recharger', () => f.webContents.reload());
}

async function ouvrirFenetre(): Promise<void> {
  const etat = lireEtatFenetre();
  const icone = path.join(__dirname, 'icon.png');

  const f = new BrowserWindow({
    width: etat.width,
    height: etat.height,
    x: etat.x,
    y: etat.y,
    minWidth: LARGEUR_MIN,
    minHeight: HAUTEUR_MIN,
    title: 'Jolis Mots',
    backgroundColor: nativeTheme.shouldUseDarkColors ? FOND_SOMBRE : FOND_CLAIR,
    icon: existsSync(icone) ? icone : undefined,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  fenetre = f;

  // Agrandir une fenêtre encore cachée la montrerait avant que la page soit peinte.
  f.once('ready-to-show', () => {
    if (etat.maximized) f.maximize();
    f.show();
  });
  f.on('close', (e) => {
    if (ficheModifiee && !quitterQuandMeme) {
      e.preventDefault();
      demanderAvantDeFermer(f);
      return;
    }
    retenirEtatFenetre();
  });
  f.on('closed', () => {
    fenetre = undefined;
  });

  // Rien d'autre que la page ne s'ouvre dans l'application.
  f.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  f.webContents.on('will-navigate', (e) => {
    if (!estLaPage(e.url)) e.preventDefault();
  });
  // Une page qui se recharge repart sans fiche ouverte : rien ne reste « modifié ».
  f.webContents.on('did-start-navigation', (e) => {
    if (e.isMainFrame && !e.isSameDocument) ficheModifiee = false;
  });

  await f.loadFile(PAGE);
}

// Une seule instance : deux fenêtres sur la même copie des mots se marcheraient dessus.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!fenetre) return;
    if (fenetre.isMinimized()) fenetre.restore();
    fenetre.focus();
  });

  app
    .whenReady()
    .then(async () => {
      brancherPont();
      poserMenu();
      await ouvrirFenetre();
    })
    .catch((erreur: unknown) => {
      console.error('Jolis Mots ne démarre pas\u202F:', erreur);
      app.quit();
    });

  app.on('window-all-closed', () => app.quit());
}
