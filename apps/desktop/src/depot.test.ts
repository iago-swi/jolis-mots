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
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classer, enregistrer, envoyer, historique, ouvrir, reprendre, synchroniser, type Depot } from './depot';

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

/**
 * Un faux GitHub qui accepte la connexion et ne répond jamais : un réseau qui cale.
 * `fermer` coupe les connexions restées ouvertes.
 */
async function serveurMuet(): Promise<{ adresse: string; connexions: () => number; fermer: () => Promise<void> }> {
  const prises = new Set<Socket>();
  let total = 0;
  const serveur = createServer((prise) => {
    total++;
    prises.add(prise);
    prise.on('error', () => undefined);
    prise.on('close', () => prises.delete(prise));
  });
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  const { port } = serveur.address() as AddressInfo;
  return {
    adresse: `http://127.0.0.1:${port}/jolis-mots.git`,
    connexions: () => total,
    fermer: () =>
      new Promise((r) => {
        for (const p of prises) p.destroy();
        serveur.close(() => r());
      }),
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
    expect(refuse.raison).toBe('refus');
    expect(refuse).toMatchObject({ locale: T3b, envoyee: T3 });
    expect(f.versionsEnLigne()).toBe(3);
    unlinkSync(crochet);
    expect(await envoyer(d, T3b, 'message 3 bis')).toMatchObject({ raison: 'pret', envoyee: T3b });
    expect(f.versionsEnLigne()).toBe(4);
    expect(f.dernierMessageEnLigne()).toBe('message 3 bis');
  });

  it('4 ter. après un envoi refusé, un envoi d’un autre texte n’ajoute qu’une version, avec son message', { timeout: DELAI }, async () => {
    const Ta = T3b.replace('"util":"rare"', '"util":"rare (a)"');
    const Tb = T3b.replace('"util":"rare"', '"util":"rare (b)"');
    const crochet = join(origine, 'hooks', 'pre-receive');
    writeFileSync(crochet, '#!/bin/sh\nexit 1\n');
    expect((await envoyer(d, Ta, 'message a')).raison).toBe('refus');
    expect(f.versionsEnLigne()).toBe(4);
    unlinkSync(crochet);
    expect(await envoyer(d, Tb, 'message b')).toMatchObject({ raison: 'pret', locale: Tb, envoyee: Tb });
    expect(readFileSync(join(d.dossier, 'mots.json'))).toEqual(Buffer.from(Tb, 'utf8'));
    expect(f.versionsEnLigne()).toBe(5);
    expect(f.dernierMessageEnLigne()).toBe('message b');
    expect(f.contenuEnLigne()).toBe(Tb);
    expect((await envoyer(d, Tb, 'encore')).raison).toBe('pret');
    expect(f.versionsEnLigne()).toBe(5);
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

  it('7 bis. un .git sans version (téléchargement tué) est laissé par ouvrir, mis de côté par synchroniser', { timeout: DELAI }, async () => {
    const { d } = preparer();
    mkdirSync(d.dossier, { recursive: true });
    git(d.dossier, 'init');
    expect(await ouvrir(d)).toEqual({ raison: 'pret', detail: '', locale: null, envoyee: null, sauvegarde: null });
    expect(existsSync(join(d.dossier, '.git'))).toBe(true);
    expect(existsSync(d.sauvegardes)).toBe(false);
    expect(await synchroniser(d)).toMatchObject({ raison: 'pret', locale: TEXTE_ORIGINE, envoyee: TEXTE_ORIGINE });
    const mis = readdirSync(d.sauvegardes);
    expect(mis).toHaveLength(1);
    expect(mis[0]).toMatch(/^donnees-\d{4}-\d{2}-\d{2}-\d{6}$/);
    expect(existsSync(join(d.sauvegardes, mis[0]!, '.git'))).toBe(true);
  });

  it('7 quater. une copie cassée qui tenait un mots.json : mise de côté, et le chemin du fichier est rendu', { timeout: DELAI }, async () => {
    const { d } = preparer();
    mkdirSync(d.dossier, { recursive: true });
    git(d.dossier, 'init');
    writeFileSync(join(d.dossier, 'mots.json'), T2, 'utf8');
    const e = await synchroniser(d);
    expect(e).toMatchObject({ raison: 'pret', locale: TEXTE_ORIGINE, envoyee: TEXTE_ORIGINE });
    const mis = readdirSync(d.sauvegardes);
    expect(mis).toHaveLength(1);
    expect(e.sauvegarde).toBe(join(d.sauvegardes, mis[0]!, 'mots.json'));
    expect(readFileSync(e.sauvegarde!, 'utf8')).toBe(T2);
  });

  it('7 quinquies. un dossier mis de côté sans mots.json : pas de chemin rendu', { timeout: DELAI }, async () => {
    const { d } = preparer();
    mkdirSync(d.dossier, { recursive: true });
    writeFileSync(join(d.dossier, 'reste.txt'), 'téléchargement interrompu');
    expect(await synchroniser(d)).toMatchObject({ raison: 'pret', sauvegarde: null });
  });

  it('7 ter. mots.json effacé à la main : ouvrir sans fichier, reprendre sans sauvegarde', { timeout: DELAI }, async () => {
    const f = preparer();
    const { d } = f;
    await synchroniser(d);
    f.pousserDepuisUnAutreClone(T4);
    unlinkSync(join(d.dossier, 'mots.json'));
    expect(await ouvrir(d)).toEqual({ raison: 'pret', detail: '', locale: null, envoyee: TEXTE_ORIGINE, sauvegarde: null });
    expect(await reprendre(d, new Date(2026, 10, 24, 15, 30, 12))).toEqual({
      raison: 'pret',
      detail: '',
      locale: T4,
      envoyee: T4,
      sauvegarde: null,
    });
    expect(existsSync(d.sauvegardes)).toBe(false);
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

  it('10. un fetch sans réponse est arrêté au bout du délai : sans-reseau, et la suite marche', { timeout: DELAI }, async () => {
    const f = preparer();
    const { d } = f;
    await synchroniser(d);
    const muet = await serveurMuet();
    try {
      git(d.dossier, 'remote', 'set-url', 'origin', muet.adresse);
      const debut = Date.now();
      const e = await synchroniser({ ...d, delais: { reseau: 1500, telechargement: 1500 } });
      expect(Date.now() - debut).toBeLessThan(15000);
      expect(e).toMatchObject({ raison: 'sans-reseau', locale: TEXTE_ORIGINE, envoyee: TEXTE_ORIGINE });
      expect(muet.connexions()).toBeGreaterThan(0);
    } finally {
      await muet.fermer();
    }
    git(d.dossier, 'remote', 'set-url', 'origin', f.origine);
    expect(await enregistrer(d, T2)).toMatchObject({ raison: 'pret', locale: T2 });
    expect(await envoyer(d, T2, 'après le délai')).toMatchObject({ raison: 'pret', envoyee: T2 });
  });

  it('11. un téléchargement sans réponse est arrêté au bout du délai ; le suivant marche', { timeout: DELAI }, async () => {
    const { d } = preparer();
    const muet = await serveurMuet();
    try {
      const debut = Date.now();
      const e = await synchroniser({ ...d, adresse: muet.adresse, delais: { reseau: 1500, telechargement: 1500 } });
      expect(Date.now() - debut).toBeLessThan(15000);
      expect(e).toMatchObject({ raison: 'sans-reseau', locale: null, envoyee: null });
    } finally {
      await muet.fermer();
    }
    expect(await synchroniser(d)).toMatchObject({ raison: 'pret', locale: TEXTE_ORIGINE, envoyee: TEXTE_ORIGINE });
  });

  it('12. un envoi sans réponse est arrêté au bout du délai : erreur, rien n’est perdu, le suivant passe', { timeout: DELAI }, async () => {
    const f = preparer();
    const { d } = f;
    await synchroniser(d);
    const muet = await serveurMuet();
    try {
      git(d.dossier, 'remote', 'set-url', '--push', 'origin', muet.adresse);
      const e = await envoyer({ ...d, delais: { reseau: 1500, telechargement: 1500, envoi: 1500 } }, T2, 'envoi bloqué');
      // Un envoi qui n'aboutit pas n'est pas forcément un réseau absent : la fenêtre de connexion a pu attendre.
      expect(e).toMatchObject({ raison: 'erreur', locale: T2, envoyee: TEXTE_ORIGINE });
      expect(e.detail).not.toBe('');
    } finally {
      await muet.fermer();
    }
    git(d.dossier, 'remote', 'set-url', '--push', 'origin', f.origine);
    expect(await envoyer(d, T2, 'envoi repris')).toMatchObject({ raison: 'pret', envoyee: T2 });
  });

  it('9. classer les messages de git', () => {
    expect(classer("fatal: unable to access 'https://github.com/x/': Could not resolve host: github.com")).toBe('sans-reseau');
    expect(classer("fatal: unable to access 'https://github.com/x/': Failed to connect to github.com port 443")).toBe('sans-reseau');
    expect(classer('remote: Permission to iago-swi/jolis-mots.git denied to autre.')).toBe('refus');
    expect(classer("fatal: Authentication failed for 'https://github.com/x/'")).toBe('refus');
    expect(classer("fatal: unable to access 'https://github.com/x/': The requested URL returned error: 403")).toBe('refus');
    expect(classer(' ! [rejected]        donnees -> donnees (fetch first)')).toBe('divergence');
    expect(classer(' ! [remote rejected] donnees -> donnees (pre-receive hook declined)')).toBe('refus');
    expect(classer("fatal: could not read Username for 'https://github.com': terminal prompts disabled")).toBe('refus');
    expect(classer('fatal: quelque chose')).toBe('erreur');
  });
});

describe('dépôt : l’histoire de la liste', () => {
  it('sans copie : null', { timeout: DELAI }, async () => {
    expect(await historique(preparer().d)).toBeNull();
  });

  it('les versions envoyées de mots.json, de la plus ancienne à la plus récente, sans réseau', { timeout: DELAI }, async () => {
    const f = preparer();
    const { d } = f;
    // Une version illisible au milieu, une version qui ne touche pas mots.json, puis deux listes.
    f.pousserDepuisUnAutreClone('{ pas du json');
    f.pousserDepuisUnAutreClone(T5);
    f.pousserDepuisUnAutreClone(T6);
    await synchroniser(d);
    const autre = join(f.racine, 'autre-4');
    git(f.racine, 'clone', '-c', 'core.autocrlf=false', '--branch', 'donnees', f.origine, autre);
    writeFileSync(join(autre, 'LISEZMOI'), 'rien', 'utf8');
    git(autre, 'add', 'LISEZMOI');
    git(autre, 'commit', '-m', 'Autre fichier');
    git(autre, 'push', 'origin', 'donnees');
    git(d.dossier, 'fetch', 'origin', 'donnees');
    // Une version locale pas encore envoyée ne compte pas : seule la liste envoyée fait l'histoire.
    await enregistrer(d, T6.replace('2026-11-26', '2026-11-27'));
    git(d.dossier, 'commit', '-am', 'Pas envoyée');
    // L'adresse en ligne disparaît : la lecture n'en a pas besoin.
    renommer(f.origine, f.origine + '.absent');
    try {
      const listes = await historique(d);
      expect(listes?.map((l) => l.publie)).toEqual(['2026-11-24', '2026-11-25', '2026-11-26']);
      expect(listes?.[2]?.mots[0]?.tri).toBe('abscons ');
    } finally {
      renommer(f.origine + '.absent', f.origine);
    }
  });
});
