/**
 * Met à jour `donnees/` avant une fabrication, pour que la liste embarquée dans
 * l'application soit la dernière envoyée par l'atelier.
 *
 * Ne fait que lire la liste en ligne : `git fetch` puis, s'il y a du nouveau,
 * `git pull --ff-only`. Rien n'est jamais validé ni envoyé.
 * - Réussi : dit de quelle date est la liste.
 * - Sans réseau : avertit et continue avec la liste déjà là.
 * - Dossier absent, modifié à la main ou en désaccord avec la liste en ligne :
 *   s'arrête en disant quoi faire.
 *
 * Usage, depuis la racine : node scripts/maj-donnees.mjs [dossier]   (par défaut : donnees)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RACINE, 'donnees');
const NOM = process.argv[2] ?? 'donnees';
const BRANCHE = 'donnees';
const FICHIER = path.join(DOSSIER, 'mots.json');

/** git dans le dossier des données, sans shell ; lève une erreur si git échoue. */
function git(...args) {
  return execFileSync('git', ['-C', DOSSIER, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Vrai si les deux chemins désignent le même dossier (noms courts, casse et barres obliques compris). */
function memeDossier(a, b) {
  const normal = (p) => realpathSync.native(p).toLowerCase();
  return normal(a) === normal(b);
}

function arreter(message) {
  console.error(`Liste des mots : ${message}`);
  process.exit(1);
}

/** La date de la liste : son champ `publie`, à défaut celle du dernier commit. */
function dateDeLaListe() {
  let iso = '';
  try {
    iso = JSON.parse(readFileSync(FICHIER, 'utf8')).publie ?? '';
  } catch {
    arreter(`« ${NOM}/mots.json » ne se lit pas.`);
  }
  let date = new Date(iso);
  if (Number.isNaN(date.getTime())) date = new Date(git('log', '-1', '--format=%cI'));
  return new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Zurich' }).format(date);
}

// 1. Le dossier doit être la copie de travail de la branche des données.
let racineGit = '';
try {
  if (existsSync(DOSSIER)) racineGit = git('rev-parse', '--show-toplevel');
} catch {
  // pas un dépôt git
}
if (!racineGit || !memeDossier(racineGit, DOSSIER) || !existsSync(FICHIER)) {
  arreter(`le dossier « ${NOM}/ » manque ou ne contient pas la branche des données. Pour le monter, depuis la racine :\n  git worktree add donnees donnees`);
}
let amont = '';
try {
  if (git('branch', '--show-current') === BRANCHE) amont = git('rev-parse', '--abbrev-ref', '@{u}');
} catch {
  // pas de branche suivie
}
if (!amont) {
  arreter(`« ${NOM}/ » n'est pas sur la branche « ${BRANCHE} » suivie en ligne. Pour voir où il en est :\n  git -C ${NOM} status`);
}

// 2. Rien de modifié à la main : un mots.json retouché ne doit pas partir dans l'application.
if (git('status', '--porcelain', '--untracked-files=no') !== '') {
  arreter(
    `« ${NOM}/mots.json » a été modifié à la main. Les mots se modifient dans l'atelier.\n` +
      `  Voir les changements : git -C ${NOM} diff\n` +
      `  Les abandonner pour reprendre la liste envoyée : git -C ${NOM} restore mots.json\n` +
      'Puis relancer la fabrication.',
  );
}

// 3. Lire la liste en ligne.
let reseau = true;
try {
  git('fetch', '--quiet', 'origin', BRANCHE);
} catch {
  reseau = false;
}

// 4. Aucun commit local absent de la liste en ligne.
const [enAvance, enRetard] = git('rev-list', '--left-right', '--count', `HEAD...${amont}`).split(/\s+/).map(Number);
if (enAvance > 0) {
  arreter(
    `« ${NOM}/ » porte ${enAvance} commit(s) que la liste en ligne n'a pas : les deux ne s'accordent plus.\n` +
      `  Voir la différence : git -C ${NOM} log --oneline ${amont}...HEAD\n` +
      "La liste se publie depuis l'atelier ; régler ce désaccord avant de fabriquer.",
  );
}

if (!reseau) {
  console.warn(`Pas de réseau : la fabrication embarque la liste du ${dateDeLaListe()}.`);
  process.exit(0);
}

if (enRetard > 0) {
  try {
    git('pull', '--ff-only', '--quiet');
  } catch (e) {
    arreter(`la mise à jour a échoué :\n${String(e.stderr ?? e.message).trim()}`);
  }
}

console.log(`Liste des mots à jour : envoyée le ${dateDeLaListe()}.`);
