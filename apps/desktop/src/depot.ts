// La copie locale de la branche `donnees`, tenue par l'atelier avec le programme `git`
// du système. Node seul, sans Electron. Aucune fonction ne lève : une panne revient
// dans `raison` et `detail`.

import { execFile } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { copyFile, mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  HISTORIQUE_MAX,
  historiqueDeListes,
  validerFichier,
  type EntreeHistorique,
  type EtatDepot,
  type FichierMots,
  type RaisonDepot,
} from '@jolis-mots/core';

export const ADRESSE_DEPOT = 'https://github.com/iago-swi/jolis-mots.git';
export const BRANCHE = 'donnees';
export const FICHIER = 'mots.json';

/**
 * Les délais au-delà desquels une opération réseau est arrêtée, en millisecondes.
 * Par défaut : 30 s pour aller voir la liste en ligne, 120 s pour télécharger la copie.
 */
export interface Delais {
  reseau: number;
  telechargement: number;
  /** L'envoi ; cinq minutes par défaut. */
  envoi?: number;
}

/** Où vit la copie locale. `git` : nom du programme, 'git' par défaut. */
export interface Depot {
  dossier: string;
  sauvegardes: string;
  adresse: string;
  git?: string;
  delais?: Delais;
}

const DELAIS: Delais = { reseau: 30_000, telechargement: 120_000 };
/**
 * L'envoi peut attendre une fenêtre de connexion du gestionnaire d'identifiants :
 * il n'est arrêté qu'au bout de cinq minutes.
 */
const DELAI_ENVOI = 5 * 60_000;
/** Un transfert qui reste sous 1000 octets par seconde pendant 30 s est abandonné par git lui-même. */
const DEBIT_MINIMAL = ['-c', 'http.lowSpeedLimit=1000', '-c', 'http.lowSpeedTime=30'];

const DISTANTE = `origin/${BRANCHE}`;

/** Levée quand le programme `git` est introuvable. */
class SansGit extends Error {}

interface Sortie {
  code: number;
  stdout: string;
  stderr: string;
  /** Vrai si git a été arrêté faute de réponse dans le délai. */
  expire?: boolean;
}

/**
 * Lance git sans passer par un shell ; ne rejette que si le programme est introuvable.
 * Avec un `delai`, git est arrêté s'il n'a pas fini à temps : la sortie porte alors `expire`.
 */
function lancer(d: Depot, cwd: string, args: string[], delai = 0): Promise<Sortie> {
  return new Promise((resoudre, rejeter) => {
    execFile(
      d.git ?? 'git',
      args,
      {
        cwd,
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        timeout: delai,
        env: { ...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' },
      },
      (erreur, stdout, stderr) => {
        if (erreur && (erreur as NodeJS.ErrnoException).code === 'ENOENT') {
          rejeter(new SansGit(erreur.message));
          return;
        }
        if (erreur && delai > 0 && erreur.killed) {
          resoudre({ code: -1, stdout, stderr, expire: true });
          return;
        }
        if (erreur && typeof erreur.code !== 'number') {
          rejeter(erreur);
          return;
        }
        resoudre({ code: erreur ? (erreur.code as number) : 0, stdout, stderr: stderr || erreur?.message || '' });
      },
    );
  });
}

/** La raison d'une sortie en échec : un git arrêté faute de réponse, c'est un réseau absent. */
function raisonDe(s: Sortie): RaisonDepot {
  return s.expire ? 'sans-reseau' : classer(s.stderr);
}

/** Une opération qui échoue : sa raison, son message. */
class Panne extends Error {
  constructor(
    readonly raison: RaisonDepot,
    readonly detail: string,
  ) {
    super(detail);
  }
}

/** Lance git dans la copie ; un code de sortie non nul devient une panne classée. */
async function git(d: Depot, ...args: string[]): Promise<string> {
  const s = await lancer(d, d.dossier, args);
  if (s.code !== 0) throw new Panne(classer(s.stderr), s.stderr.trim());
  return s.stdout;
}

/** Va voir la liste en ligne ; arrêté au bout du délai réseau. */
async function allerChercher(d: Depot): Promise<void> {
  const s = await lancer(d, d.dossier, [...DEBIT_MINIMAL, 'fetch', 'origin', BRANCHE], (d.delais ?? DELAIS).reseau);
  if (s.code !== 0) throw new Panne(raisonDe(s), s.stderr.trim());
}

/**
 * Envoie la branche ; arrêté au bout de cinq minutes. Un envoi qui n'aboutit pas n'est pas
 * forcément un réseau absent (la fenêtre de connexion a pu attendre) : c'est une erreur.
 */
async function pousser(d: Depot): Promise<void> {
  const s = await lancer(d, d.dossier, [...DEBIT_MINIMAL, 'push', 'origin', BRANCHE], d.delais?.envoi ?? DELAI_ENVOI);
  if (s.expire) throw new Panne('erreur', s.stderr.trim() || 'git push: no answer before the time limit');
  if (s.code !== 0) throw new Panne(classer(s.stderr), s.stderr.trim());
}

/** Vrai si `ancetre` est un ancêtre de `rev` (ou le même commit). */
async function estAncetre(d: Depot, ancetre: string, rev: string): Promise<boolean> {
  const s = await lancer(d, d.dossier, ['merge-base', '--is-ancestor', ancetre, rev]);
  if (s.code === 0) return true;
  if (s.code === 1) return false;
  throw new Panne(classer(s.stderr), s.stderr.trim());
}

/** Classe un message de git (en anglais, LC_ALL=C). */
export function classer(stderr: string): RaisonDepot {
  const a403 = /\b403\b/.test(stderr);
  if (
    /Could not resolve host|Failed to connect|timed out/i.test(stderr) ||
    (/unable to access/i.test(stderr) && !a403)
  ) {
    return 'sans-reseau';
  }
  if (
    /Authentication failed/i.test(stderr) ||
    (/Permission/i.test(stderr) && /denied/i.test(stderr)) ||
    a403 ||
    // Pas d'identifiants enregistrés, et git n'a pas le droit de les demander.
    /could not read Username|terminal prompts disabled/i.test(stderr)
  ) {
    return 'refus';
  }
  if (/\[rejected\]|non-fast-forward|fetch first/i.test(stderr)) return 'divergence';
  // Le serveur lui-même décline l'envoi (crochet, branche protégée).
  if (/\[remote rejected\]/i.test(stderr)) return 'refus';
  return 'erreur';
}

// Les opérations passent une à la fois.
let file: Promise<unknown> = Promise.resolve();

/** Met l'opération en file ; toute exception devient un état avec sa raison. */
function enFile(d: Depot, operation: () => Promise<EtatDepot>): Promise<EtatDepot> {
  const suite = file.then(async () => {
    try {
      return await operation();
    } catch (e) {
      if (e instanceof SansGit) return etat(d, 'sans-git', e.message);
      if (e instanceof Panne) return etat(d, e.raison, e.detail);
      return etat(d, 'erreur', e instanceof Error ? e.message : String(e));
    }
  });
  file = suite.catch(() => undefined);
  return suite;
}

/**
 * Vrai si le dossier tient une copie utilisable : un `.git` dont HEAD désigne une version.
 * Un téléchargement tué en route peut laisser un `.git` sans HEAD : ce n'est pas une copie.
 * Le `--git-dir` explicite empêche git de chercher un autre dépôt dans les dossiers parents.
 */
async function aUneCopie(d: Depot): Promise<boolean> {
  const gitDir = join(d.dossier, '.git');
  if (!existsSync(gitDir)) return false;
  const s = await lancer(d, d.dossier, ['--git-dir', gitDir, 'rev-parse', '--verify', '--quiet', 'HEAD']);
  return s.code === 0;
}

/** L'état de la copie, lu sur le disque, sans réseau. */
async function etat(d: Depot, raison: RaisonDepot, detail = '', sauvegarde: string | null = null): Promise<EtatDepot> {
  let copie: boolean;
  try {
    copie = await aUneCopie(d);
  } catch {
    // Sans git, on ne peut pas vérifier HEAD : on s'en tient au `.git`.
    copie = existsSync(join(d.dossier, '.git'));
  }
  if (!copie) return { raison, detail, locale: null, envoyee: null, sauvegarde };
  let locale: string | null = null;
  let envoyee: string | null = null;
  try {
    locale = await readFile(join(d.dossier, FICHIER), 'utf8');
  } catch {
    locale = null;
  }
  try {
    const s = await lancer(d, d.dossier, ['show', `${DISTANTE}:${FICHIER}`]);
    if (s.code === 0) envoyee = s.stdout;
  } catch {
    envoyee = null;
  }
  return { raison, detail, locale, envoyee, sauvegarde };
}

/** AAAA-MM-JJ-HHMMSS, en heure locale. */
function horodatage(t: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}-` + `${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}`
  );
}

/** Windows garde parfois un fichier ouvert un instant après la fin de git. */
async function renommer(de: string, vers: string): Promise<void> {
  for (let essai = 0; ; essai++) {
    try {
      await rename(de, vers);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (essai >= 20 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/**
 * Écrit mots.json : fichier temporaire dans le même dossier, écrit jusqu'au disque, puis renommage.
 * UTF-8 sans BOM, octets exacts. Les écritures passant une à la fois, le nom temporaire est fixe.
 */
async function ecrire(d: Depot, texte: string): Promise<void> {
  const cible = join(d.dossier, FICHIER);
  const temporaire = `${cible}.tmp`;
  const fichier = await open(temporaire, 'w');
  try {
    await fichier.writeFile(Buffer.from(texte, 'utf8'));
    await fichier.sync();
  } finally {
    await fichier.close();
  }
  await renommer(temporaire, cible);
}

function sansCopie(d: Depot): Promise<EtatDepot> {
  return etat(d, 'erreur', `Pas de copie locale dans ${d.dossier}.`);
}

/**
 * Télécharge la copie. Un dossier sans copie utilisable (téléchargement interrompu, HEAD cassé)
 * est d'abord mis de côté ; s'il tenait un mots.json, son nouveau chemin revient dans `sauvegarde`.
 */
async function telecharger(d: Depot): Promise<EtatDepot> {
  let sauvegarde: string | null = null;
  if (existsSync(d.dossier)) {
    await mkdir(d.sauvegardes, { recursive: true });
    const ailleurs = join(d.sauvegardes, `donnees-${horodatage(new Date())}`);
    await renommer(d.dossier, ailleurs);
    if (existsSync(join(ailleurs, FICHIER))) sauvegarde = join(ailleurs, FICHIER);
  }
  const parent = dirname(d.dossier);
  await mkdir(parent, { recursive: true });
  const s = await lancer(
    d,
    parent,
    [...DEBIT_MINIMAL, 'clone', '-c', 'core.autocrlf=false', '--single-branch', '--branch', BRANCHE, d.adresse, d.dossier],
    (d.delais ?? DELAIS).telechargement,
  );
  if (s.code !== 0) return etat(d, raisonDe(s), s.stderr.trim(), sauvegarde);
  return etat(d, 'pret', '', sauvegarde);
}

/** Ce qui est sur le disque, sans réseau. */
export function ouvrir(d: Depot): Promise<EtatDepot> {
  return enFile(d, () => etat(d, 'pret'));
}

/** Télécharge la copie si elle manque, sinon va voir la liste en ligne. */
export function synchroniser(d: Depot): Promise<EtatDepot> {
  return enFile(d, async () => {
    if (!(await aUneCopie(d))) return telecharger(d);
    await allerChercher(d);
    // La liste en ligne n'a pas bougé, ou la copie a seulement une version pas encore envoyée.
    if (await estAncetre(d, DISTANTE, 'HEAD')) return etat(d, 'pret');
    // La liste en ligne a avancé : avance rapide si rien n'attend ici.
    const fichierInchange = (await lancer(d, d.dossier, ['diff', '--quiet', 'HEAD', '--', FICHIER])).code === 0;
    if (fichierInchange && (await estAncetre(d, 'HEAD', DISTANTE))) {
      await git(d, 'merge', '--ff-only', DISTANTE);
      return etat(d, 'pret');
    }
    return etat(d, 'divergence');
  });
}

/** Écrit le texte dans la copie de travail. */
export function enregistrer(d: Depot, texte: string): Promise<EtatDepot> {
  return enFile(d, async () => {
    if (!(await aUneCopie(d))) return sansCopie(d);
    await ecrire(d, texte);
    return etat(d, 'pret');
  });
}

/** Écrit, valide si besoin, puis envoie ; n'écrase jamais la liste en ligne. */
export function envoyer(d: Depot, texte: string, message: string): Promise<EtatDepot> {
  return enFile(d, async () => {
    if (!(await aUneCopie(d))) return sansCopie(d);
    await ecrire(d, texte);
    await allerChercher(d);
    if (!(await estAncetre(d, DISTANTE, 'HEAD'))) return etat(d, 'divergence');
    // Une version restée ici après un envoi manqué est refaite avec le texte et le message
    // de cet envoi : une seule version de plus en ligne. La liste en ligne étant un ancêtre
    // de HEAD, seules des versions jamais envoyées sont défaites ; le fichier ne bouge pas.
    await git(d, 'reset', '--soft', DISTANTE);
    await git(d, 'add', FICHIER);
    const aValider = (await lancer(d, d.dossier, ['diff', '--cached', '--quiet'])).code !== 0;
    if (aValider) await git(d, 'commit', '-m', message);
    await pousser(d);
    return etat(d, 'pret');
  });
}

/** Copie mots.json dans les sauvegardes, sans jamais en écraser une ; null s'il n'y a pas de fichier. */
async function mettreDeCote(d: Depot, maintenant: Date): Promise<string | null> {
  const local = join(d.dossier, FICHIER);
  if (!existsSync(local)) return null;
  await mkdir(d.sauvegardes, { recursive: true });
  const base = join(d.sauvegardes, `mots-${horodatage(maintenant)}`);
  let sauvegarde = `${base}.json`;
  for (let n = 2; ; n++) {
    try {
      await copyFile(local, sauvegarde, constants.COPYFILE_EXCL);
      return sauvegarde;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      sauvegarde = `${base}-${n}.json`;
    }
  }
}

/**
 * Met le fichier local de côté, puis reprend la liste en ligne (dans cette copie privée seulement).
 * Sans fichier local, il n'y a rien à mettre de côté : `sauvegarde` reste null.
 */
export function reprendre(d: Depot, maintenant: Date): Promise<EtatDepot> {
  return enFile(d, async () => {
    if (!(await aUneCopie(d))) return sansCopie(d);
    const sauvegarde = await mettreDeCote(d, maintenant);
    try {
      await allerChercher(d);
      await git(d, 'reset', '--hard', DISTANTE);
    } catch (e) {
      if (e instanceof Panne) return etat(d, e.raison, e.detail, sauvegarde);
      throw e;
    }
    return etat(d, 'pret', '', sauvegarde);
  });
}

/** Le délai de lecture de l'histoire, tout en local. */
const DELAI_HISTOIRE = 60_000;

/**
 * Lit des objets de la copie en une seule fois (`git cat-file --batch`) : le contenu de chacun,
 * ou null s'il manque. Rejette si git échoue ou dépasse le délai.
 */
function lireObjets(d: Depot, noms: string[]): Promise<(Buffer | null)[]> {
  return new Promise((resoudre, rejeter) => {
    const enfant = execFile(
      d.git ?? 'git',
      ['cat-file', '--batch'],
      {
        cwd: d.dossier,
        windowsHide: true,
        encoding: 'buffer',
        maxBuffer: 1024 * 1024 * 1024,
        timeout: DELAI_HISTOIRE,
        env: { ...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' },
      },
      (erreur, stdout) => {
        if (erreur) {
          rejeter(erreur);
          return;
        }
        // Chaque objet : une ligne « <nom> <type> <taille> », le contenu, un saut de ligne ;
        // ou la seule ligne « <demande> missing ».
        const objets: (Buffer | null)[] = [];
        let pos = 0;
        for (let i = 0; i < noms.length; i++) {
          const fin = stdout.indexOf(0x0a, pos);
          if (fin === -1) {
            rejeter(new Error('git cat-file: réponse incomplète'));
            return;
          }
          const tete = stdout.subarray(pos, fin).toString('utf8').split(' ');
          pos = fin + 1;
          if (tete.length !== 3 || tete[1] !== 'blob') {
            objets.push(null);
            continue;
          }
          const taille = Number(tete[2]);
          objets.push(stdout.subarray(pos, pos + taille));
          pos += taille + 1;
        }
        resoudre(objets);
      },
    );
    enfant.stdin?.on('error', () => undefined);
    enfant.stdin?.end(noms.map((n) => `${n}\n`).join(''));
  });
}

/**
 * Les versions envoyées de mots.json (la branche `donnees` telle que la copie l'a reçue),
 * de la plus ancienne à la plus récente, sans réseau ; une version illisible ou invalide est
 * sautée. Seules les HISTORIQUE_MAX + 1 dernières sont lues : l'historique n'en garde pas plus.
 * null sans copie ou si git échoue. Hors de la file des opérations : la lecture n'attend pas
 * une synchronisation lente, et ne touche à rien.
 */
export async function historique(d: Depot): Promise<FichierMots[] | null> {
  try {
    if (!(await aUneCopie(d))) return null;
    const s = await lancer(
      d,
      d.dossier,
      ['log', '--format=%H', '--reverse', '-n', String(HISTORIQUE_MAX + 1), DISTANTE, '--', FICHIER],
      DELAI_HISTOIRE,
    );
    if (s.code !== 0) return null;
    const versions = s.stdout.split('\n').filter((h) => /^[0-9a-f]{40,64}$/.test(h));
    if (versions.length === 0) return [];
    const contenus = await lireObjets(d, versions.map((h) => `${h}:${FICHIER}`));
    const listes: FichierMots[] = [];
    for (const c of contenus) {
      if (c === null) continue;
      try {
        const f = validerFichier(JSON.parse(c.toString('utf8')));
        if (f !== null) listes.push(f);
      } catch {
        // Une version qui ne se lit pas est sautée.
      }
    }
    return listes;
  } catch {
    return null;
  }
}

/**
 * L'historique de la liste (conception, section 15.5), gardé tant que la liste en ligne de la
 * copie (`origin/donnees`) reste la même version : rouvrir l'écran ne relit ni ne recalcule rien.
 * Deux demandes pendant un calcul partagent le même. null sans copie ou si la lecture échoue
 * (rien n'est alors gardé). `lire` sert aux essais.
 */
export function historiqueEnCache(
  lire: (d: Depot) => Promise<FichierMots[] | null> = historique,
): (d: Depot) => Promise<EntreeHistorique[] | null> {
  let garde: { cle: string; resultat: Promise<EntreeHistorique[] | null> } | null = null;
  return async (d) => {
    try {
      if (!(await aUneCopie(d))) return null;
      const s = await lancer(d, d.dossier, ['rev-parse', '--verify', '--quiet', `${DISTANTE}^{commit}`]);
      if (s.code !== 0) return null;
      const cle = `${d.dossier}\u0000${s.stdout.trim()}`;
      if (garde === null || garde.cle !== cle) {
        const resultat = lire(d).then((l) => (l === null ? null : historiqueDeListes(l)));
        garde = { cle, resultat };
        // Un échec n'est pas gardé : la prochaine demande relit.
        void resultat.then((h) => {
          if (h === null && garde?.resultat === resultat) garde = null;
        });
      }
      return await garde.resultat;
    } catch {
      return null;
    }
  };
}
