import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classer, enregistrer, envoyer, ouvrir, reprendre, synchroniser, type Depot } from './depot';

// Tout se passe dans un dossier temporaire : un dépôt nu `origine.git` tient lieu de GitHub.
// Aucun test ne contacte le réseau ni ne touche au dépôt du projet.

const DELAI = 30_000;

const TEXTE_ORIGINE =
  '{\n  "format": 1,\n  "publie": "2026-11-24",\n  "mots": [\n' +
  '    {"id":"a1","mot":"abscons","tri":"abscons","genre":"adj.","definition":"Difficile à comprendre.","sources":[],"note":"","util":"","aCompleter":false}\n' +
  '  ]\n}\n';
const T2 = TEXTE_ORIGINE.replace('"note":""', '"note":"  😀\\u2028"');
const T3 = T2.replace('Difficile', 'Très difficile');
const T3b = T3.replace('"util":""', '"util":"rare"');
const T4 = T3b.replace('abscons","genre', 'abscons ","genre');
const T5 = T4.replace('"publie": "2026-11-24"', '"publie": "2026-11-25"');
const T6 = T4.replace('"publie": "2026-11-24"', '"publie": "2026-11-26"');

const IDENTITE = {
  GIT_AUTHOR_NAME: 'Essai',
  GIT_AUTHOR_EMAIL: 'essai@example.invalid',
  GIT_COMMITTER_NAME: 'Essai',
  GIT_COMMITTER_EMAIL: 'essai@example.invalid',
};
const anciennes: Record<string, string | undefined> = {};
const racines: string[] = [];

beforeAll(() => {
  for (const [cle, valeur] of Object.entries(IDENTITE)) {
    anciennes[cle] = process.env[cle];
    process.env[cle] = valeur;
  }
});

afterAll(() => {
  for (const [cle, valeur] of Object.entries(anciennes)) {
    if (valeur === undefined) delete process.env[cle];
    else process.env[cle] = valeur;
  }
  for (const r of racines) rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...IDENTITE, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' },
  });
}

/** Windows garde parfois un fichier ouvert un instant après la fin de git. */
function renommer(de: string, vers: string): void {
  for (let essai = 0; ; essai++) {
    try {
      renameSync(de, vers);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (essai >= 20 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

/** Un dossier temporaire avec un dépôt nu qui porte `donnees` et un `mots.json`. */
function preparer() {
  const racine = mkdtempSync(join(tmpdir(), 'jolis-mots-depot-'));
  racines.push(racine);
  const origine = join(racine, 'origine.git');
  git(racine, 'init', '--bare', '-b', 'donnees', origine);
  const graine = join(racine, 'graine');
  git(racine, 'init', '-b', 'donnees', graine);
  writeFileSync(join(graine, 'mots.json'), TEXTE_ORIGINE, 'utf8');
  git(graine, 'add', 'mots.json');
  git(graine, 'commit', '-m', 'Liste initiale');
  git(graine, 'push', origine, 'donnees');
  const d: Depot = {
    dossier: join(racine, 'atelier', 'donnees'),
    sauvegardes: join(racine, 'atelier', 'sauvegardes'),
    adresse: origine,
  };
  let autres = 0;
  return {
    racine,
    origine,
    d,
    versionsEnLigne: () => Number(git(origine, 'rev-list', '--count', 'donnees').trim()),
    dernierMessageEnLigne: () => git(origine, 'log', '-1', '--format=%s', 'donnees').trim(),
    contenuEnLigne: () => git(origine, 'show', 'donnees:mots.json'),
    pousserDepuisUnAutreClone(texte: string) {
      const autre = join(racine, `autre-${++autres}`);
      git(racine, 'clone', '-c', 'core.autocrlf=false', '--branch', 'donnees', origine, autre);
      writeFileSync(join(autre, 'mots.json'), texte, 'utf8');
      git(autre, 'commit', '-am', 'Ailleurs');
      git(autre, 'push', 'origin', 'donnees');
    },
  };
}

describe('dépôt : parcours complet', () => {
  const f = preparer();
  const { d, origine } = f;

  it('1. sans copie : ouvrir ne donne rien, synchroniser télécharge', { timeout: DELAI }, async () => {
    expect(await ouvrir(d)).toEqual({ raison: 'pret', detail: '', locale: null, envoyee: null, sauvegarde: null });
    const e1 = await synchroniser(d);
    expect(e1).toMatchObject({ raison: 'pret', locale: TEXTE_ORIGINE, envoyee: TEXTE_ORIGINE });
    expect(readFileSync(join(d.dossier, 'mots.json'))).toEqual(Buffer.from(TEXTE_ORIGINE, 'utf8'));
  });

  it('2. enregistrer écrit les octets exacts, la liste envoyée ne bouge pas', { timeout: DELAI }, async () => {
    expect(await enregistrer(d, T2)).toMatchObject({ raison: 'pret', locale: T2, envoyee: TEXTE_ORIGINE });
    expect(readFileSync(join(d.dossier, 'mots.json'))).toEqual(Buffer.from(T2, 'utf8'));
    expect(readdirSync(d.dossier).sort()).toEqual(['.git', 'mots.json']);
  });

  it('3. envoyer ajoute une version en ligne, une seule', { timeout: DELAI }, async () => {
    expect(await envoyer(d, T2, 'Liste du 24 novembre 2026 : 1 mot modifié')).toMatchObject({
      raison: 'pret',
      detail: '',
      envoyee: T2,
    });
    expect(f.versionsEnLigne()).toBe(2);
    expect(f.dernierMessageEnLigne()).toBe('Liste du 24 novembre 2026 : 1 mot modifié');
    expect(f.contenuEnLigne()).toBe(T2);
    expect((await envoyer(d, T2, 'encore')).raison).toBe('pret');
    expect(f.versionsEnLigne()).toBe(2);
  });

  it('4. un envoi coupé garde la version locale ; repris, il n’en ajoute qu’une', { timeout: DELAI }, async () => {
    renommer(origine, origine + '.absent');
    const coupe = await envoyer(d, T3, 'message 3');
    expect(coupe.raison).not.toBe('pret');
    expect(coupe.detail).not.toBe('');
    expect(coupe).toMatchObject({ locale: T3, envoyee: T2 });
    expect((await ouvrir(d)).locale).toBe(T3);
    renommer(origine + '.absent', origine);
    expect((await envoyer(d, T3, 'message 3')).raison).toBe('pret');
    expect(f.versionsEnLigne()).toBe(3);
    expect(f.contenuEnLigne()).toBe(T3);
  });

  it('4 bis. un envoi refusé en ligne garde la version locale ; repris, il n’en ajoute qu’une', { timeout: DELAI }, async () => {
    const crochet = join(origine, 'hooks', 'pre-receive');
    writeFileSync(crochet, '#!/bin/sh\nexit 1\n');
    const refuse = await envoyer(d, T3b, 'message 3 bis');
    expect(refuse.raison).not.toBe('pret');
    expect(refuse).toMatchObject({ locale: T3b, envoyee: T3 });
    expect(f.versionsEnLigne()).toBe(3);
    unlinkSync(crochet);
    expect(await envoyer(d, T3b, 'message 3 bis')).toMatchObject({ raison: 'pret', envoyee: T3b });
    expect(f.versionsEnLigne()).toBe(4);
    expect(f.dernierMessageEnLigne()).toBe('message 3 bis');
  });

  it('5. la liste en ligne avance ailleurs, rien n’attend ici : reprise silencieuse', { timeout: DELAI }, async () => {
    f.pousserDepuisUnAutreClone(T4);
    expect(await synchroniser(d)).toMatchObject({ raison: 'pret', locale: T4, envoyee: T4 });
    expect(readFileSync(join(d.dossier, 'mots.json'))).toEqual(Buffer.from(T4, 'utf8'));
  });

  it('6. la liste en ligne avance ailleurs, des modifications attendent ici : divergence', { timeout: DELAI }, async () => {
    await enregistrer(d, T5);
    f.pousserDepuisUnAutreClone(T6);
    expect(await synchroniser(d)).toMatchObject({ raison: 'divergence', locale: T5 });
    expect((await envoyer(d, T5, 'm')).raison).toBe('divergence');
    expect(f.contenuEnLigne()).toBe(T6);
    expect(readFileSync(join(d.dossier, 'mots.json'), 'utf8')).toBe(T5);
    const repris = await reprendre(d, new Date(2026, 10, 24, 15, 30, 12));
    expect(repris).toMatchObject({ raison: 'pret', locale: T6, envoyee: T6 });
    expect(repris.sauvegarde).toMatch(/mots-2026-11-24-153012\.json$/);
    expect(readFileSync(repris.sauvegarde!, 'utf8')).toBe(T5);
    expect(readFileSync(join(d.dossier, 'mots.json'), 'utf8')).toBe(T6);
  });
});

describe('dépôt : cas à part', () => {
  it('7. un dossier sans .git est mis de côté, puis la copie est téléchargée', { timeout: DELAI }, async () => {
    const { d } = preparer();
    mkdirSync(d.dossier, { recursive: true });
    writeFileSync(join(d.dossier, 'reste.txt'), 'téléchargement interrompu');
    expect(await synchroniser(d)).toMatchObject({ raison: 'pret', locale: TEXTE_ORIGINE, envoyee: TEXTE_ORIGINE });
    const mis = readdirSync(d.sauvegardes);
    expect(mis).toHaveLength(1);
    expect(mis[0]).toMatch(/^donnees-\d{4}-\d{2}-\d{2}-\d{6}$/);
    expect(readFileSync(join(d.sauvegardes, mis[0]!, 'reste.txt'), 'utf8')).toBe('téléchargement interrompu');
    expect(existsSync(join(d.dossier, '.git'))).toBe(true);
  });

  it('8. git introuvable : sans-git, sans lever', { timeout: DELAI }, async () => {
    const { d } = preparer();
    const e = await synchroniser({ ...d, git: 'git-introuvable' });
    expect(e.raison).toBe('sans-git');
    expect(e.locale).toBeNull();
  });

  it('les opérations passent une à la fois', { timeout: DELAI }, async () => {
    const { d } = preparer();
    await synchroniser(d);
    const premier = enregistrer(d, T2);
    const second = enregistrer(d, T3);
    const [e1, e2] = await Promise.all([premier, second]);
    expect(e1).toMatchObject({ raison: 'pret', locale: T2 });
    expect(e2).toMatchObject({ raison: 'pret', locale: T3 });
    expect(readFileSync(join(d.dossier, 'mots.json'), 'utf8')).toBe(T3);
  });

  it('9. classer les messages de git', () => {
    expect(classer("fatal: unable to access 'https://github.com/x/': Could not resolve host: github.com")).toBe('sans-reseau');
    expect(classer("fatal: unable to access 'https://github.com/x/': Failed to connect to github.com port 443")).toBe('sans-reseau');
    expect(classer('remote: Permission to iago-swi/jolis-mots.git denied to autre.')).toBe('refus');
    expect(classer("fatal: Authentication failed for 'https://github.com/x/'")).toBe('refus');
    expect(classer("fatal: unable to access 'https://github.com/x/': The requested URL returned error: 403")).toBe('refus');
    expect(classer(' ! [rejected]        donnees -> donnees (fetch first)')).toBe('divergence');
    expect(classer('fatal: quelque chose')).toBe('erreur');
  });
});
