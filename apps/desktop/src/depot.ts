// La copie locale de la branche `donnees`, tenue par l'atelier avec le programme `git`
// du système. Node seul, sans Electron. Aucune fonction ne lève : une panne revient
// dans `raison` et `detail`.

import { execFile } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { EtatDepot, RaisonDepot } from '@jolis-mots/core';

export const ADRESSE_DEPOT = 'https://github.com/iago-swi/jolis-mots.git';
export const BRANCHE = 'donnees';
export const FICHIER = 'mots.json';

/** Où vit la copie locale. `git` : nom du programme, 'git' par défaut. */
export interface Depot {
  dossier: string;
  sauvegardes: string;
  adresse: string;
  git?: string;
}

const DISTANTE = `origin/${BRANCHE}`;

/** Levée quand le programme `git` est introuvable. */
class SansGit extends Error {}

interface Sortie {
  code: number;
  stdout: string;
  stderr: string;
}

/** Lance git sans passer par un shell ; ne rejette que si le programme est introuvable. */
function lancer(d: Depot, cwd: string, args: string[]): Promise<Sortie> {
  return new Promise((resoudre, rejeter) => {
    execFile(
      d.git ?? 'git',
      args,
      {
        cwd,
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' },
      },
      (erreur, stdout, stderr) => {
        if (erreur && (erreur as NodeJS.ErrnoException).code === 'ENOENT') {
          rejeter(new SansGit(erreur.message));
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
  if (/Authentication failed/i.test(stderr) || (/Permission/i.test(stderr) && /denied/i.test(stderr)) || a403) {
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

function aUneCopie(d: Depot): boolean {
  return existsSync(join(d.dossier, '.git'));
}

/** L'état de la copie, lu sur le disque, sans réseau. */
async function etat(d: Depot, raison: RaisonDepot, detail = '', sauvegarde: string | null = null): Promise<EtatDepot> {
  if (!aUneCopie(d)) return { raison, detail, locale: null, envoyee: null, sauvegarde };
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

/** Écrit mots.json : fichier temporaire dans le même dossier, puis renommage. UTF-8 sans BOM, octets exacts. */
async function ecrire(d: Depot, texte: string): Promise<void> {
  const cible = join(d.dossier, FICHIER);
  const temporaire = `${cible}.${process.pid}.tmp`;
  await writeFile(temporaire, Buffer.from(texte, 'utf8'));
  await renommer(temporaire, cible);
}

function sansCopie(d: Depot): Promise<EtatDepot> {
  return etat(d, 'erreur', `Pas de copie locale dans ${d.dossier}.`);
}

/** Télécharge la copie ; un dossier sans .git (téléchargement interrompu) est d'abord mis de côté. */
async function telecharger(d: Depot): Promise<EtatDepot> {
  if (existsSync(d.dossier)) {
    await mkdir(d.sauvegardes, { recursive: true });
    await renommer(d.dossier, join(d.sauvegardes, `donnees-${horodatage(new Date())}`));
  }
  const parent = dirname(d.dossier);
  await mkdir(parent, { recursive: true });
  const s = await lancer(d, parent, [
    'clone',
    '-c',
    'core.autocrlf=false',
    '--single-branch',
    '--branch',
    BRANCHE,
    d.adresse,
    d.dossier,
  ]);
  if (s.code !== 0) return etat(d, classer(s.stderr), s.stderr.trim());
  return etat(d, 'pret');
}

/** Ce qui est sur le disque, sans réseau. */
export function ouvrir(d: Depot): Promise<EtatDepot> {
  return enFile(d, () => etat(d, 'pret'));
}

/** Télécharge la copie si elle manque, sinon va voir la liste en ligne. */
export function synchroniser(d: Depot): Promise<EtatDepot> {
  return enFile(d, async () => {
    if (!aUneCopie(d)) return telecharger(d);
    await git(d, 'fetch', 'origin', BRANCHE);
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
    if (!aUneCopie(d)) return sansCopie(d);
    await ecrire(d, texte);
    return etat(d, 'pret');
  });
}

/** Écrit, valide si besoin, puis envoie ; n'écrase jamais la liste en ligne. */
export function envoyer(d: Depot, texte: string, message: string): Promise<EtatDepot> {
  return enFile(d, async () => {
    if (!aUneCopie(d)) return sansCopie(d);
    await ecrire(d, texte);
    await git(d, 'fetch', 'origin', BRANCHE);
    if (!(await estAncetre(d, DISTANTE, 'HEAD'))) return etat(d, 'divergence');
    await git(d, 'add', FICHIER);
    const aValider = (await lancer(d, d.dossier, ['diff', '--cached', '--quiet'])).code !== 0;
    if (aValider) await git(d, 'commit', '-m', message);
    await git(d, 'push', 'origin', BRANCHE);
    return etat(d, 'pret');
  });
}

/** Met le fichier local de côté, puis reprend la liste en ligne (dans cette copie privée seulement). */
export function reprendre(d: Depot, maintenant: Date): Promise<EtatDepot> {
  return enFile(d, async () => {
    if (!aUneCopie(d)) return sansCopie(d);
    await mkdir(d.sauvegardes, { recursive: true });
    const base = join(d.sauvegardes, `mots-${horodatage(maintenant)}`);
    let sauvegarde = `${base}.json`;
    for (let n = 2; ; n++) {
      try {
        await copyFile(join(d.dossier, FICHIER), sauvegarde, constants.COPYFILE_EXCL);
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        sauvegarde = `${base}-${n}.json`;
      }
    }
    try {
      await git(d, 'fetch', 'origin', BRANCHE);
      await git(d, 'reset', '--hard', DISTANTE);
    } catch (e) {
      if (e instanceof Panne) return etat(d, e.raison, e.detail, sauvegarde);
      throw e;
    }
    return etat(d, 'pret', '', sauvegarde);
  });
}
