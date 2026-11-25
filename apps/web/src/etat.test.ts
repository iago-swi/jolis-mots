import type { FichierMots, Mot } from '@jolis-mots/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mot(id: string, autres: Partial<Mot> = {}): Mot {
  return {
    id,
    mot: `mot ${id}`,
    tri: `mot ${id}`,
    genre: 'n. m.',
    definition: `Définition de ${id}.`,
    sources: [],
    note: '',
    util: '',
    aCompleter: false,
    ...autres,
  };
}

const embarquee: FichierMots = {
  format: 1,
  publie: '2026-11-01T08:00:00.000Z',
  mots: [mot('a1'), mot('a2'), mot('a3'), mot('a4', { definition: '' })],
};

const listePlusRecente: FichierMots = {
  format: 1,
  publie: '2026-11-20T08:00:00.000Z',
  mots: [...embarquee.mots, mot('b1')],
};

const sansMotComplet: FichierMots = {
  format: 1,
  publie: '2026-11-01T08:00:00.000Z',
  mots: [mot('c1', { aCompleter: true }), mot('c2', { definition: '' })],
};

// La vraie liste embarquée (plus de 700 ko, hors du dépôt) n'est jamais chargée : chaque test choisit la sienne.
const liste = vi.hoisted(() => ({ embarquee: null as FichierMots | null }));
vi.mock('./liste-embarquee', () => ({
  get listeEmbarquee() {
    return liste.embarquee;
  },
}));

const CLE_LISTE = 'jolismots.liste.v1';
const CLE_PROGRES = 'jolismots.progres.v1';
const CLE_REGLAGES = 'jolismots.reglages.v1';

/** Un `localStorage` fait d'une `Map`, rempli de `depart`. */
function poserStockage(depart: Record<string, string> = {}): Map<string, string> {
  const m = new Map(Object.entries(depart));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  });
  return m;
}

/** Modules neufs, comme à un nouveau lancement de l'application. */
async function lancer() {
  vi.resetModules();
  const { etat } = await import('./etat.svelte');
  const { rafraichir } = await import('./miseAJour');
  return { etat, rafraichir };
}

function repondreAvec(corps: string, init?: ResponseInit): void {
  vi.stubGlobal('fetch', async () => new Response(corps, init));
}

beforeEach(() => {
  liste.embarquee = embarquee;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('la liste en ligne', () => {
  it('de bout en bout : gardée sur l’appareil, puis adoptée au mot suivant', async () => {
    poserStockage();
    const { etat, rafraichir } = await lancer();
    repondreAvec(JSON.stringify(listePlusRecente));
    etat.demarrer({ search: '', hash: '' });
    await rafraichir();
    expect(etat.liste.publie).toBe(embarquee.publie);
    expect(JSON.parse(localStorage.getItem(CLE_LISTE)!).publie).toBe(listePlusRecente.publie);
    etat.suivant();
    expect(etat.liste.publie).toBe(listePlusRecente.publie);
  });

  it('au lancement suivant, la liste gardée est préférée à l’embarquée', async () => {
    poserStockage();
    const premier = await lancer();
    repondreAvec(JSON.stringify(listePlusRecente));
    premier.etat.demarrer({ search: '', hash: '' });
    await premier.rafraichir();

    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '' });
    expect(etat.liste.publie).toBe(listePlusRecente.publie);
  });

  const inutilisables: [string, () => void][] = [
    ['404', () => repondreAvec('Not Found', { status: 404 })],
    ['texte HTML', () => repondreAvec('<!doctype html><title>Erreur</title>', { headers: { 'content-type': 'text/html' } })],
    ['JSON tronqué', () => repondreAvec(JSON.stringify(listePlusRecente).slice(0, 80))],
    ['date plus ancienne', () => repondreAvec(JSON.stringify({ ...listePlusRecente, publie: '2026-10-01T08:00:00.000Z' }))],
    ['liste vide', () => repondreAvec(JSON.stringify({ ...listePlusRecente, mots: [] }))],
    [
      'fetch qui lève',
      () =>
        vi.stubGlobal('fetch', async () => {
          throw new TypeError('Failed to fetch');
        }),
    ],
  ];

  for (const [nom, poserReponse] of inutilisables) {
    it(`réponse inutilisable (${nom}) : rien ne change, rien n'est levé`, async () => {
      const stockage = poserStockage();
      const { etat, rafraichir } = await lancer();
      poserReponse();
      etat.demarrer({ search: '', hash: '' });
      await expect(rafraichir()).resolves.toBeUndefined();
      etat.suivant();
      expect(etat.liste.publie).toBe(embarquee.publie);
      expect(stockage.has(CLE_LISTE)).toBe(false);
    });
  }

  it('sans mot complet en place, la liste reçue est adoptée tout de suite', async () => {
    liste.embarquee = sansMotComplet;
    poserStockage();
    const { etat, rafraichir } = await lancer();
    repondreAvec(JSON.stringify(listePlusRecente));
    etat.demarrer({ search: '', hash: '' });
    expect(etat.motCourant).toBeNull();
    await rafraichir();
    expect(etat.liste.publie).toBe(listePlusRecente.publie);
    expect(etat.motCourant).not.toBeNull();
  });
});

describe('la lecture', () => {
  it('n’a pas de fin : tous les mots lus, « Mot suivant » reprend le plus anciennement vu', async () => {
    // Une minute entre deux mots : les dates de vue sont toutes différentes.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-24T08:00:00.000Z') });
    poserStockage();
    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '' });
    vi.advanceTimersByTime(60_000);
    etat.suivant();
    vi.advanceTimersByTime(60_000);
    etat.suivant();
    vi.advanceTimersByTime(60_000);
    const [premier, , dernier] = etat.lus;
    expect(new Set(etat.lus).size).toBe(3);
    etat.suivant();
    expect(etat.lus).toHaveLength(4);
    expect(etat.motCourant!.id).not.toBe(dernier);
    expect(etat.motCourant!.id).toBe(premier);
  });
});

describe('remplacerListe', () => {
  it('sans le mot courant (supprimé) : un autre mot est montré, `lus` ne garde que des mots complets', async () => {
    poserStockage();
    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '' });
    etat.suivant();
    etat.remplacerListe({ ...embarquee, mots: embarquee.mots.filter((m) => m.id !== etat.motCourant!.id) });
    expect(etat.motCourant).not.toBeNull();
    expect(etat.lus.every((id) => etat.complets.some((m) => m.id === id))).toBe(true);
  });

  it('sans le mot courant (passé « à compléter ») : un autre mot est montré', async () => {
    poserStockage();
    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '' });
    const courant = etat.motCourant!.id;
    etat.remplacerListe({
      ...embarquee,
      mots: embarquee.mots.map((m) => (m.id === courant ? { ...m, aCompleter: true } : m)),
    });
    expect(etat.motCourant).not.toBeNull();
    expect(etat.motCourant!.id).not.toBe(courant);
    expect(etat.lus.every((id) => etat.complets.some((m) => m.id === id))).toBe(true);
  });

  it('posée avant le démarrage : ne tire rien, `demarrer` tire un seul mot', async () => {
    poserStockage();
    const { etat } = await lancer();
    etat.remplacerListe(listePlusRecente);
    expect(etat.lus).toEqual([]);
    expect(etat.progres).toEqual({});
    etat.demarrer({ search: '', hash: '' });
    expect(etat.lus).toHaveLength(1);
    expect(Object.keys(etat.progres)).toEqual(etat.lus);
  });

  it('posée avant le démarrage, avec « ?mot= » : ce mot est le premier et le seul lu', async () => {
    poserStockage();
    const { etat } = await lancer();
    etat.remplacerListe(listePlusRecente);
    etat.demarrer({ search: '?mot=mot%20b1', hash: '' });
    expect(etat.lus).toEqual(['b1']);
    expect(Object.keys(etat.progres)).toEqual(['b1']);
  });

  it('une liste encore plus récente posée pendant qu’une liste téléchargée attend : elle reste', async () => {
    poserStockage();
    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '' });
    const encorePlusRecente = { ...listePlusRecente, publie: '2026-11-22T08:00:00.000Z' };
    etat.proposerListe(listePlusRecente);
    etat.remplacerListe(encorePlusRecente);
    etat.suivant();
    expect(etat.liste.publie).toBe(encorePlusRecente.publie);
  });

  it('une liste plus ancienne posée pendant qu’une liste téléchargée attend : l’attente est adoptée au mot suivant', async () => {
    poserStockage();
    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '' });
    etat.proposerListe(listePlusRecente);
    etat.remplacerListe({ ...embarquee, mots: embarquee.mots.filter((m) => m.id !== 'a3') });
    expect(etat.liste.publie).toBe(embarquee.publie);
    etat.suivant();
    expect(etat.liste.publie).toBe(listePlusRecente.publie);
  });

  it('ferme la fiche ouverte quand son mot disparaît, la garde sinon', async () => {
    poserStockage();
    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '' });
    etat.ficheOuverte = 'a2';
    etat.remplacerListe({ ...embarquee, mots: embarquee.mots.filter((m) => m.id !== 'a3') });
    expect(etat.ficheOuverte).toBe('a2');
    etat.remplacerListe({ ...embarquee, mots: embarquee.mots.filter((m) => m.id !== 'a2') });
    expect(etat.ficheOuverte).toBeNull();
  });
});

describe('ce que l’appareil a gardé', () => {
  it('progrès abîmés : l’état démarre avec les seules entrées valides', async () => {
    const a1 = { vu: '2026-11-02T08:00:00.000Z', case: 2, du: '2026-11-05T08:00:00.000Z', acquis: false };
    poserStockage({ [CLE_PROGRES]: JSON.stringify({ x: 5, a1 }) });
    const { etat } = await lancer();
    expect(etat.progres).toEqual({ a1 });
    etat.demarrer({ search: '', hash: '' });
    expect(Object.hasOwn(etat.progres, 'x')).toBe(false);
  });

  it('réglages de la 0.1.0 : la taille de séance est ignorée, la palette gardée', async () => {
    poserStockage({ [CLE_REGLAGES]: JSON.stringify({ motsParSeance: 8, palette: 'nuit' }) });
    const { etat } = await lancer();
    expect(etat.reglages).toEqual({ questionsParQuiz: 10, palette: 'nuit' });
  });

  it('reglerQuestions borne aux tailles proposées et enregistre', async () => {
    const stockage = poserStockage();
    const { etat } = await lancer();
    etat.reglerQuestions(12);
    expect(etat.reglages.questionsParQuiz).toBe(15);
    etat.reglerQuestions(50);
    expect(etat.reglages.questionsParQuiz).toBe(20);
    expect(JSON.parse(stockage.get(CLE_REGLAGES)!).questionsParQuiz).toBe(20);
  });
});

describe('l’adresse', () => {
  it('« ?quiz=vus » demande le quiz sur les mots vus ; une autre valeur, rien', async () => {
    poserStockage();
    let { etat } = await lancer();
    etat.demarrer({ search: '?quiz=vus', hash: '#quiz' });
    expect(etat.quizDemande).toBe('vus');
    expect(etat.ecran).toBe('quiz');

    ({ etat } = await lancer());
    etat.demarrer({ search: '?quiz=tous', hash: '#quiz' });
    expect(etat.quizDemande).toBe('tous');

    ({ etat } = await lancer());
    etat.demarrer({ search: '?quiz=autre', hash: '#quiz' });
    expect(etat.quizDemande).toBeNull();
  });
});

describe('l’historique de la liste', () => {
  it('s’ouvre au premier démarrage, puis note la liste reçue avec ses mots nouveaux', async () => {
    poserStockage();
    const { etat, rafraichir } = await lancer();
    repondreAvec(JSON.stringify(listePlusRecente));
    etat.demarrer({ search: '', hash: '' });
    expect(etat.historique).toEqual([
      { publie: embarquee.publie, debut: true, total: 3, ajoutes: [], modifies: [], supprimes: [] },
    ]);
    await rafraichir();
    // La liste reçue n'est adoptée qu'au mot suivant : l'historique aussi attend.
    expect(etat.historique).toHaveLength(1);
    etat.suivant();
    expect(etat.historique).toHaveLength(2);
    expect(etat.historique[1]).toMatchObject({
      publie: listePlusRecente.publie,
      debut: false,
      total: 4,
      ajoutes: [{ id: 'b1', mot: 'mot b1' }],
    });
  });

  it('est gardé sur l’appareil et repris au lancement suivant, sans doublon', async () => {
    const stockage = poserStockage();
    const premier = await lancer();
    premier.etat.demarrer({ search: '', hash: '' });
    premier.etat.remplacerListe(listePlusRecente);
    expect(premier.etat.historique).toHaveLength(2);
    expect(stockage.has('jolismots.historique.v1')).toBe(true);
    const second = await lancer();
    second.etat.demarrer({ search: '', hash: '' });
    expect(second.etat.historique).toEqual(premier.etat.historique);
  });

  it('un historique illisible repart de zéro sans rien casser', async () => {
    poserStockage({ 'jolismots.historique.v1': '{pas du json', 'jolismots.reference.v1': '[1,2]' });
    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '' });
    expect(etat.historique).toHaveLength(1);
    expect(etat.historique[0]?.debut).toBe(true);
  });

  it('« Historique » se ferme vers les réglages, qui se ferment vers l’écran d’avant', async () => {
    poserStockage();
    const { etat } = await lancer();
    etat.demarrer({ search: '', hash: '#recueil' });
    etat.allerA('reglages');
    etat.allerA('historique');
    expect(etat.retour()).toBe(true);
    expect(etat.ecran).toBe('reglages');
    expect(etat.retour()).toBe(true);
    expect(etat.ecran).toBe('recueil');
  });
});
