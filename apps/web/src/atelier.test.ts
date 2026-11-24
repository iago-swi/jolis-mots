import { ecrireFichier, type EtatDepot, type FichierMots, type Mot, type PontBureau, type RaisonDepot } from '@jolis-mots/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mot(id: string, autres: Partial<Mot> = {}): Mot {
  return {
    id,
    mot: `mot ${id}`,
    tri: `mot ${id}`,
    genre: 'adj.',
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
  mots: [mot('a1'), mot('a2')],
};

const fiche = mot('k3f9x2', { mot: 'Vénuste', tri: 'vénuste', definition: '1. [Litt., rare] Qui a de la grâce.' });

const locale: FichierMots = {
  format: 1,
  publie: '2026-11-20T08:00:00Z',
  mots: [mot('bbbbb1'), mot('bbbbb2'), mot('bbbbb3', { aCompleter: true }), fiche],
};

const ILLISIBLE =
  "Le fichier des mots de l'atelier est illisible. Tu peux reprendre la liste en ligne ; ta version sera mise de côté.";
const CONNEXION = "L'atelier a besoin d'une connexion une première fois, pour recevoir la liste.";
const SANS_GIT = "Git est introuvable sur cette machine. L'atelier en a besoin pour recevoir et envoyer la liste.";
const DIVERGENCE = "La liste en ligne a changé ailleurs. Rien n'a été envoyé.";
const ENREGISTREMENT = "La fiche n'a pas pu être enregistrée.";

// La vraie liste embarquée n'est jamais chargée (voir etat.test.ts).
vi.mock('./liste-embarquee', () => ({ listeEmbarquee: embarquee }));

function poserStockage(): void {
  const m = new Map<string, string>();
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
}

type Operation = 'ouvrir' | 'synchroniser' | 'enregistrer' | 'envoyer' | 'reprendre';

/** Un pont qui imite la copie locale en mémoire, note ses appels et échoue sur demande. */
class FauxPont implements PontBureau {
  appels: Operation[] = [];
  enregistre: string[] = [];
  envois: { texte: string; message: string }[] = [];
  /** La raison rendue par chaque opération ('rejet' : la promesse est rejetée). */
  pannes: Partial<Record<Operation, RaisonDepot | 'rejet'>> = {};
  /** Ce que `synchroniser` reçoit de la liste en ligne, s'il y a lieu. */
  enLigne: string | null = null;
  /** `synchroniser` attend cette promesse avant de répondre. */
  retenue: Promise<void> | null = null;
  sauvegarde = 'C:\\Donnees\\sauvegardes\\mots-2026-11-24-100000.json';

  constructor(
    public locale: string | null,
    public envoyee: string | null = locale,
  ) {}

  private async issue(op: Operation, effet: () => void, sauvegarde: string | null = null): Promise<EtatDepot> {
    this.appels.push(op);
    const panne = this.pannes[op];
    if (panne === 'rejet') throw new Error('Canal fermé');
    if (panne !== undefined && panne !== 'pret') return this.etat(panne, `git : ${panne}`);
    effet();
    return this.etat('pret', '', sauvegarde);
  }

  private etat(raison: RaisonDepot, detail = '', sauvegarde: string | null = null): EtatDepot {
    return { raison, detail, locale: this.locale, envoyee: this.envoyee, sauvegarde };
  }

  ouvrir(): Promise<EtatDepot> {
    return this.issue('ouvrir', () => {});
  }

  async synchroniser(): Promise<EtatDepot> {
    if (this.retenue) await this.retenue;
    return this.issue('synchroniser', () => {
      if (this.enLigne !== null) this.locale = this.envoyee = this.enLigne;
    });
  }

  enregistrer(texte: string): Promise<EtatDepot> {
    this.enregistre.push(texte);
    return this.issue('enregistrer', () => {
      this.locale = texte;
    });
  }

  envoyer(texte: string, message: string): Promise<EtatDepot> {
    this.envois.push({ texte, message });
    // Comme le vrai dépôt : le fichier est écrit avant d'aller voir la liste en ligne.
    if (this.pannes.envoyer !== 'rejet') this.locale = texte;
    return this.issue('envoyer', () => {
      this.envoyee = texte;
    });
  }

  reprendre(): Promise<EtatDepot> {
    const sauvegarde = this.locale === null ? null : this.sauvegarde;
    return this.issue(
      'reprendre',
      () => {
        this.locale = this.envoyee;
      },
      sauvegarde,
    );
  }

  async ouvrirCnrtl(): Promise<void> {}

  signalerFicheModifiee(): void {}
}

/** Modules neufs, comme à un nouveau lancement de l'application. */
async function lancer() {
  vi.resetModules();
  const { etat } = await import('./etat.svelte');
  const { Atelier } = await import('./atelier.svelte');
  return { etat, Atelier };
}

/** Laisse finir ce qui tourne en arrière-plan (le faux pont répond sans délai). */
const laisserFinir = () => new Promise((r) => setTimeout(r, 0));

/** L'atelier démarré sur une copie locale lisible, la lecture aussi. */
async function demarrerSur(faux: FauxPont) {
  const { etat, Atelier } = await lancer();
  const atelier = new Atelier(faux);
  await atelier.demarrer();
  etat.demarrer({ search: '', hash: '' });
  await laisserFinir();
  return { etat, atelier };
}

beforeEach(() => {
  poserStockage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('le démarrage', () => {
  it('la liste locale remplace l’embarquée', async () => {
    const { etat, Atelier } = await lancer();
    const atelier = new Atelier(new FauxPont(ecrireFichier(locale)));
    await atelier.demarrer();
    expect(etat.liste.publie).toBe(locale.publie);
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toBeNull();
    expect(atelier.modifications.total).toBe(0);
  });

  it('pas de copie : pas d’alarme tant que la première synchronisation tourne', async () => {
    let lacher!: () => void;
    const faux = new FauxPont(null, null);
    faux.retenue = new Promise((r) => (lacher = r));
    faux.pannes.synchroniser = 'sans-reseau';
    const { etat, Atelier } = await lancer();
    const atelier = new Atelier(faux);
    await atelier.demarrer();
    expect(atelier.disponible).toBe(false);
    expect(atelier.avis).toBeNull();
    expect(atelier.occupe).toBe(true);
    lacher();
    await laisserFinir();
    expect(atelier.occupe).toBe(false);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: CONNEXION });
    expect(etat.liste.publie).toBe(embarquee.publie);
  });

  it('pas de copie et pas de git', async () => {
    const faux = new FauxPont(null, null);
    faux.pannes.synchroniser = 'sans-git';
    const { atelier } = await demarrerSur(faux);
    expect(atelier.disponible).toBe(false);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: SANS_GIT });
  });

  it('pas de copie, puis la copie téléchargée : la liste reçue est adoptée', async () => {
    const faux = new FauxPont(null, null);
    faux.enLigne = ecrireFichier(locale);
    const { etat, atelier } = await demarrerSur(faux);
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toBeNull();
    expect(etat.liste.publie).toBe(locale.publie);
    expect(etat.motCourant).not.toBeNull();
  });

  it('une copie et pas de réseau : l’atelier travaille sans rien dire', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    faux.pannes.synchroniser = 'sans-reseau';
    const { atelier } = await demarrerSur(faux);
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toBeNull();
  });

  it('la liste en ligne a changé ailleurs : avis de divergence', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    faux.pannes.synchroniser = 'divergence';
    const { atelier } = await demarrerSur(faux);
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: DIVERGENCE });
  });

  it('une liste plus récente en ligne remplace la liste ; la même liste ne remplace rien', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const recente = { ...locale, publie: '2026-11-23T08:00:00Z', mots: [...locale.mots, mot('bbbbb4')] };
    faux.enLigne = ecrireFichier(recente);
    const { etat, atelier } = await demarrerSur(faux);
    expect(etat.liste.publie).toBe(recente.publie);

    const remplacer = vi.spyOn(etat, 'remplacerListe');
    await atelier.reessayer();
    expect(remplacer).not.toHaveBeenCalled();
  });

  it('un pont qui rejette ne fait pas tomber le démarrage', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    faux.pannes.ouvrir = 'rejet';
    faux.pannes.synchroniser = 'rejet';
    const { etat, Atelier } = await lancer();
    const atelier = new Atelier(faux);
    await expect(atelier.demarrer()).resolves.toBeUndefined();
    await laisserFinir();
    expect(atelier.disponible).toBe(false);
    expect(atelier.depot?.raison).toBe('erreur');
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: CONNEXION });
    expect(etat.liste.publie).toBe(embarquee.publie);
  });
});

describe('la copie illisible', () => {
  const illisibles: [string, () => FauxPont][] = [
    ['JSON tronqué', () => new FauxPont('{"format":1,"publie":', ecrireFichier(locale))],
    ['mots.json manquant', () => new FauxPont(null, ecrireFichier(locale))],
    [
      'identifiant porté deux fois',
      () => new FauxPont(ecrireFichier({ ...locale, mots: [...locale.mots, fiche] }), ecrireFichier(locale)),
    ],
  ];

  for (const [nom, creer] of illisibles) {
    it(`${nom} : indisponible, rien n'est écrit, la lecture garde l'embarquée`, async () => {
      const faux = creer();
      const { etat, atelier } = await demarrerSur(faux);
      expect(atelier.disponible).toBe(false);
      expect(atelier.avis).toEqual({ ton: 'alerte', texte: ILLISIBLE });
      expect(etat.liste.publie).toBe(embarquee.publie);

      expect(await atelier.enregistrer(mot('a1', { mot: 'Autre' }))).toBe(false);
      expect(await atelier.supprimer('a1')).toBe(false);
      await atelier.envoyer();
      expect(faux.appels).not.toContain('enregistrer');
      expect(faux.appels).not.toContain('envoyer');
      expect(faux.enregistre).toHaveLength(0);
      expect(faux.envois).toHaveLength(0);
      expect(atelier.avis).toEqual({ ton: 'alerte', texte: ILLISIBLE });
    });
  }

  it('reprendre : la liste en ligne est adoptée, la version mise de côté est dite', async () => {
    const faux = new FauxPont('{"format":1,"publie":', ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    await atelier.reprendre();
    expect(atelier.disponible).toBe(true);
    expect(etat.liste.publie).toBe(locale.publie);
    expect(atelier.avis).toEqual({
      ton: 'calme',
      texte: `La liste en ligne est reprise. Ta version est gardée ici : ${faux.sauvegarde}`,
    });
  });

  it('reprendre sans fichier à mettre de côté : pas de chemin', async () => {
    const faux = new FauxPont(null, ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    await atelier.reprendre();
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toEqual({ ton: 'calme', texte: 'La liste en ligne est reprise.' });
  });

  it('reprendre qui échoue : la copie reste illisible', async () => {
    const faux = new FauxPont('{"format":1,"publie":', ecrireFichier(locale));
    faux.pannes.reprendre = 'sans-reseau';
    const { atelier } = await demarrerSur(faux);
    await atelier.reprendre();
    expect(atelier.disponible).toBe(false);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: ILLISIBLE });
  });
});

describe('enregistrer et supprimer', () => {
  it('mot et tri nettoyés, définition intacte, texte écrit par ecrireFichier', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    expect(await atelier.enregistrer({ ...fiche, mot: ' Vénuste ', tri: '\u00a0vénuste ', definition: '  1. Texte \n' })).toBe(
      true,
    );
    const ecrit = faux.enregistre.at(-1)!;
    const enregistree = (JSON.parse(ecrit) as FichierMots).mots.find((m) => m.id === fiche.id);
    expect(enregistree).toMatchObject({ mot: 'Vénuste', tri: 'vénuste', definition: '  1. Texte \n' });
    expect(ecrit).toBe(ecrireFichier(etat.liste));
    expect(etat.liste.mots.find((m) => m.id === fiche.id)!.definition).toBe('  1. Texte \n');
    expect(atelier.modifications.total).toBe(1);
    expect(atelier.avis).toBeNull();
  });

  it('les champs de la fiche sont écrits dans l’ordre du fichier, sans rien d’autre', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    const { id, ...reste } = mot('n3uf00');
    await atelier.enregistrer({ ...reste, intrus: 1, id } as Mot);
    expect(faux.enregistre.at(-1)).toContain(JSON.stringify(mot('n3uf00')));
  });

  const echecs: [string, RaisonDepot | 'rejet'][] = [
    ['raison erreur', 'erreur'],
    ['promesse rejetée', 'rejet'],
  ];
  for (const [nom, panne] of echecs) {
    it(`enregistrement qui échoue (${nom}) : rien ne change`, async () => {
      const faux = new FauxPont(ecrireFichier(locale));
      const { etat, atelier } = await demarrerSur(faux);
      const avant = etat.liste;
      faux.pannes.enregistrer = panne;
      expect(await atelier.enregistrer({ ...fiche, mot: 'Autre' })).toBe(false);
      expect(etat.liste).toBe(avant);
      expect(etat.liste.mots.find((m) => m.id === fiche.id)!.mot).toBe('Vénuste');
      expect(atelier.modifications.total).toBe(0);
      expect(atelier.avis).toEqual({ ton: 'alerte', texte: ENREGISTREMENT });
    });
  }

  it('supprimer le mot affiché sur l’écran Mot : un autre mot est montré', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    const affiche = etat.motCourant!.id;
    expect(await atelier.supprimer(affiche)).toBe(true);
    expect(etat.motCourant).not.toBeNull();
    expect(etat.motCourant!.id).not.toBe(affiche);
    expect(etat.liste.mots.some((m) => m.id === affiche)).toBe(false);
    expect(atelier.modifications).toMatchObject({ supprimes: 1, total: 1 });
  });

  it('un mot renommé garde son identifiant, son favori et ses progrès', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    etat.basculerFavori(fiche.id);
    etat.repondre(fiche.id, true);
    const progres = etat.progres[fiche.id];
    expect(await atelier.enregistrer({ ...fiche, mot: 'Vénustes' })).toBe(true);
    expect(etat.liste.mots.find((m) => m.id === fiche.id)!.mot).toBe('Vénustes');
    expect(etat.favoris).toContain(fiche.id);
    expect(etat.progres[fiche.id]).toEqual(progres);
  });

  it('idNeuf ne rend jamais un identifiant déjà porté, ni celui d’un mot supprimé pas encore envoyé', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    await atelier.supprimer('bbbbb1');
    // creerId tire un octet par caractère : 'a' = 0 … 'z' = 25, '0' = 26 … '9' = 35.
    const octets = [...'bbbbb1k3f9x2zzzzzz'].map((c) => 'abcdefghijklmnopqrstuvwxyz0123456789'.indexOf(c));
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => {
        a[0] = octets.shift()!;
        return a;
      },
    });
    expect(atelier.idNeuf()).toBe('zzzzzz');
  });
});

describe('envoyer', () => {
  it('une liste fautive n’appelle pas le pont', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    etat.remplacerListe({ ...locale, mots: [...locale.mots, { ...fiche, mot: 'Double' }] });
    await atelier.envoyer();
    expect(faux.envois).toHaveLength(0);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: 'Deux mots portent le même identifiant (k3f9x2).' });
  });

  it('envoi réussi : publie mis à jour, message de version, compteur à zéro', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-24T10:00:00.000Z') });
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    await atelier.enregistrer({ ...fiche, definition: 'Autre définition.' });
    await atelier.envoyer();
    expect(faux.envois).toHaveLength(1);
    expect(faux.envois[0]!.message).toBe('Liste du 24 novembre 2026 : 1 mot modifié');
    expect(JSON.parse(faux.envois[0]!.texte).publie).toBe('2026-11-24T10:00:00Z');
    expect(etat.liste.publie).toBe('2026-11-24T10:00:00Z');
    expect(atelier.modifications.total).toBe(0);
    expect(atelier.avis).toEqual({ ton: 'calme', texte: 'Liste envoyée. Le téléphone la verra dans quelques minutes.' });
  });

  const pannes: [RaisonDepot | 'rejet', string][] = [
    ['sans-reseau', "Pas de réseau : la liste n'est pas partie. Tes modifications restent en attente."],
    ['refus', "GitHub a refusé l'envoi. Tes modifications restent en attente."],
    ['divergence', DIVERGENCE],
    ['erreur', "L'envoi a échoué. Tes modifications restent en attente."],
    ['rejet', "L'envoi a échoué. Tes modifications restent en attente."],
    ['sans-git', SANS_GIT],
  ];
  for (const [panne, texte] of pannes) {
    it(`échec (${panne}) : son avis, mot pour mot, et les modifications restent en attente`, async () => {
      const faux = new FauxPont(ecrireFichier(locale));
      const { atelier } = await demarrerSur(faux);
      await atelier.enregistrer({ ...fiche, definition: 'Autre définition.' });
      faux.pannes.envoyer = panne;
      await atelier.envoyer();
      expect(faux.envois).toHaveLength(1);
      expect(atelier.avis).toEqual({ ton: 'alerte', texte });
      expect(atelier.modifications.total).toBe(1);
      expect(atelier.disponible).toBe(true);
    });
  }
});
