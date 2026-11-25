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
  "Le fichier des mots de l'atelier est illisible. Tu peux reprendre la liste en ligne\u202F; ta version sera mise de côté.";
const CONNEXION = "L'atelier a besoin d'une connexion une première fois, pour recevoir la liste.";
const SANS_GIT = "Git est introuvable sur cette machine. L'atelier en a besoin pour recevoir et envoyer la liste.";
const DIVERGENCE = "La liste en ligne a changé ailleurs. Rien n'a été envoyé.";
const ENREGISTREMENT = "La fiche n'a pas pu être enregistrée.";
const VERIFICATION = "L'atelier n'a pas pu vérifier la liste en ligne. Tu peux continuer à travailler.";
const RECEPTION = "L'atelier n'a pas pu recevoir la liste.";
const REPRISE = "La liste en ligne n'a pas pu être reprise. Rien n'a changé ici.";
const MISE_DE_COTE = "L'ancienne copie de l'atelier a été mise de côté ici\u202F:";
const ENVOYEE_INCONNUE =
  "L'atelier ne trouve pas la dernière liste envoyée\u202F: il ne peut ni compter les modifications ni envoyer.";
const SANS_RESEAU = "Pas de réseau\u202F: la liste n'est pas partie. Tes modifications restent en attente.";

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
  /** Le chemin que rend `synchroniser` quand il a mis une copie cassée de côté. */
  miseDeCote: string | null = null;
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
    if (panne !== undefined && panne !== 'pret') return this.etat(panne, `git : ${panne}`, sauvegarde);
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
    return this.issue(
      'synchroniser',
      () => {
        if (this.enLigne !== null) this.locale = this.envoyee = this.enLigne;
      },
      this.miseDeCote,
    );
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
    // Le message de git ne se montre que sous un avis d'alerte : pas de ligne orpheline.
    expect(atelier.depot?.detail).toBe('git : sans-reseau');
    expect(atelier.detail).toBe('');
  });

  it('le message de git accompagne l’avis d’alerte d’un envoi échoué', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    await atelier.enregistrer({ ...fiche, definition: 'Autre définition.' });
    faux.pannes.envoyer = 'sans-reseau';
    await atelier.envoyer();
    expect(atelier.avis?.ton).toBe('alerte');
    expect(atelier.detail).toBe('git : sans-reseau');
  });

  it('le message de git reste celui de l’alerte, même après une vérification muette', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    await atelier.enregistrer({ ...fiche, definition: 'Autre définition.' });
    faux.pannes.envoyer = 'refus';
    await atelier.envoyer();
    expect(atelier.detail).toBe('git : refus');
    faux.pannes.synchroniser = 'sans-reseau';
    await atelier.reessayer();
    expect(atelier.avis?.ton).toBe('alerte');
    expect(atelier.detail).toBe('git : refus');
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

  it('une synchronisation qui lève une erreur après coup ne laisse pas de rejet sans prise', async () => {
    let lacher!: () => void;
    const faux = new FauxPont(ecrireFichier(locale));
    faux.retenue = new Promise((r) => (lacher = r));
    faux.enLigne = ecrireFichier({ ...locale, publie: '2026-11-23T08:00:00Z' });
    const { etat, Atelier } = await lancer();
    const atelier = new Atelier(faux);
    await atelier.demarrer();
    const remplacer = vi.spyOn(etat, 'remplacerListe').mockImplementation(() => {
      throw new Error('écran tombé');
    });
    const sansPrise = vi.fn();
    process.on('unhandledRejection', sansPrise);
    try {
      lacher();
      await laisserFinir();
      await laisserFinir();
    } finally {
      process.off('unhandledRejection', sansPrise);
    }
    expect(remplacer).toHaveBeenCalled();
    expect(sansPrise).not.toHaveBeenCalled();
    expect(atelier.occupe).toBe(false);
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
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: RECEPTION });
    expect(etat.liste.publie).toBe(embarquee.publie);
  });

  for (const panne of ['erreur', 'refus', 'rejet'] as const) {
    it(`pas de copie et le téléchargement échoue (${panne}) : la liste n'a pas pu être reçue`, async () => {
      const faux = new FauxPont(null, null);
      faux.pannes.synchroniser = panne;
      const { atelier } = await demarrerSur(faux);
      expect(atelier.disponible).toBe(false);
      expect(atelier.avis).toEqual({ ton: 'alerte', texte: RECEPTION });
    });
  }

  it('l’ouverture rejetée, puis pas de réseau : la liste n’a pas pu être reçue, pas « une première fois »', async () => {
    const faux = new FauxPont(null, null);
    faux.pannes.ouvrir = 'rejet';
    faux.pannes.synchroniser = 'sans-reseau';
    const { atelier } = await demarrerSur(faux);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: RECEPTION });
  });

  for (const panne of ['refus', 'erreur', 'rejet'] as const) {
    it(`une copie et la liste en ligne pas vérifiée (${panne}) : l’avis le dit, l’atelier reste ouvert`, async () => {
      const faux = new FauxPont(ecrireFichier(locale));
      faux.pannes.synchroniser = panne;
      const { atelier } = await demarrerSur(faux);
      expect(atelier.disponible).toBe(true);
      expect(atelier.avis).toEqual({ ton: 'alerte', texte: VERIFICATION });
    });
  }
});

describe('la copie cassée, mise de côté', () => {
  it('la synchronisation a mis une copie cassée de côté : l’avis calme donne le chemin, tel quel', async () => {
    const faux = new FauxPont(null, null);
    faux.enLigne = ecrireFichier(locale);
    faux.miseDeCote = "C:\\Users\\O'Brien\\AppData\\Roaming\\Jolis Mots\\sauvegardes\\donnees-2026-11-25-101500\\mots.json";
    const { atelier } = await demarrerSur(faux);
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toEqual({ ton: 'calme', texte: MISE_DE_COTE, chemin: faux.miseDeCote });
  });

  it('la mise de côté puis l’échec du téléchargement : l’alerte dit les deux, avec le chemin', async () => {
    const faux = new FauxPont(null, null);
    faux.pannes.synchroniser = 'sans-reseau';
    faux.miseDeCote = 'C:\\Donnees\\sauvegardes\\donnees-2026-11-25-101500\\mots.json';
    const { atelier } = await demarrerSur(faux);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: `${CONNEXION} ${MISE_DE_COTE}`, chemin: faux.miseDeCote });
  });

  it('la liste reçue ensuite : la phrase sur la connexion s’efface, le chemin reste', async () => {
    const faux = new FauxPont(null, null);
    faux.pannes.synchroniser = 'sans-reseau';
    faux.miseDeCote = 'C:\\Donnees\\sauvegardes\\donnees-2026-11-25-101500\\mots.json';
    const { atelier } = await demarrerSur(faux);
    const chemin = faux.miseDeCote;
    delete faux.pannes.synchroniser;
    faux.miseDeCote = null;
    faux.enLigne = ecrireFichier(locale);
    await atelier.reessayer();
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toEqual({ ton: 'calme', texte: MISE_DE_COTE, chemin });
  });
});

describe('la dernière liste envoyée inconnue', () => {
  it('sans git : pas de nombre, pas d’envoi, l’avis le dit', async () => {
    const faux = new FauxPont(ecrireFichier(locale), null);
    faux.pannes.synchroniser = 'sans-git';
    const { atelier } = await demarrerSur(faux);
    expect(atelier.disponible).toBe(true);
    expect(atelier.envoyeeConnue).toBe(false);
    expect(atelier.modifications.total).toBe(0);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: SANS_GIT });
    await atelier.envoyer();
    expect(faux.envois).toHaveLength(0);
  });

  it('git présent mais pas de liste envoyée : l’avis le dit ; une synchronisation qui la trouve l’efface', async () => {
    const faux = new FauxPont(ecrireFichier(locale), null);
    const { atelier } = await demarrerSur(faux);
    expect(atelier.envoyeeConnue).toBe(false);
    expect(atelier.modifications.total).toBe(0);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: ENVOYEE_INCONNUE });
    faux.envoyee = ecrireFichier(locale);
    await atelier.reessayer();
    expect(atelier.envoyeeConnue).toBe(true);
    expect(atelier.avis).toBeNull();
  });
});

describe('la fiche ouverte quand la liste est remplacée', () => {
  const changee = { ...fiche, definition: '1. [Litt.] Qui a de la grâce, du charme.' };
  const nouvelle: FichierMots = { ...locale, publie: '2026-11-23T08:00:00Z', mots: [...locale.mots.filter((m) => m !== fiche), changee] };

  it('une synchronisation apporte une liste plus récente : la fiche non modifiée suit', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    faux.enLigne = ecrireFichier(nouvelle);
    await atelier.reessayer();
    expect(atelier.brouillon).toEqual(changee);
    expect(atelier.modifiee).toBe(false);
  });

  it('une reprise : la fiche non modifiée suit la liste reprise', async () => {
    const faux = new FauxPont(ecrireFichier(locale), ecrireFichier(nouvelle));
    faux.pannes.synchroniser = 'divergence';
    const { atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    await atelier.reprendre();
    expect(atelier.brouillon).toEqual(changee);
    expect(atelier.modifiee).toBe(false);
  });

  it('une fiche modifiée reste un brouillon, comparé au mot de la nouvelle liste', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    atelier.brouillon!.note = 'XX';
    faux.enLigne = ecrireFichier(nouvelle);
    await atelier.reessayer();
    expect(atelier.brouillon).toEqual({ ...fiche, note: 'XX' });
    expect(atelier.modifiee).toBe(true);
    atelier.brouillon!.note = '';
    atelier.brouillon!.definition = changee.definition;
    expect(atelier.modifiee).toBe(false);
  });

  it('le mot de la fiche non modifiée n’est plus dans la nouvelle liste : la fiche se ferme', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    faux.enLigne = ecrireFichier({ ...nouvelle, mots: nouvelle.mots.filter((m) => m.id !== fiche.id) });
    await atelier.reessayer();
    expect(atelier.brouillon).toBeNull();
  });
});

describe('réessayer', () => {
  it('un réessai sans réseau garde l’avis d’un envoi échoué', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    await atelier.enregistrer({ ...fiche, definition: 'Autre définition.' });
    faux.pannes.envoyer = 'sans-reseau';
    await atelier.envoyer();
    faux.pannes.synchroniser = 'sans-reseau';
    await atelier.reessayer();
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: SANS_RESEAU });
    delete faux.pannes.synchroniser;
    await atelier.reessayer();
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: SANS_RESEAU });
  });

  it('un réessai réussi efface l’avis d’une synchronisation ratée', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    faux.pannes.synchroniser = 'refus';
    const { atelier } = await demarrerSur(faux);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: VERIFICATION });
    delete faux.pannes.synchroniser;
    await atelier.reessayer();
    expect(atelier.avis).toBeNull();
  });

  it('pas de copie, puis la copie reçue au réessai : l’avis s’efface', async () => {
    const faux = new FauxPont(null, null);
    faux.pannes.synchroniser = 'sans-reseau';
    const { atelier } = await demarrerSur(faux);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: CONNEXION });
    delete faux.pannes.synchroniser;
    faux.enLigne = ecrireFichier(locale);
    await atelier.reessayer();
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toBeNull();
  });
});

describe('la liste en ligne changée ailleurs', () => {
  async function enDivergence() {
    const faux = new FauxPont(ecrireFichier(locale));
    faux.pannes.synchroniser = 'divergence';
    const demarre = await demarrerSur(faux);
    expect(demarre.atelier.divergence).toBe(true);
    return { faux, ...demarre };
  }

  it('un enregistrement réussi ne fait pas oublier la divergence', async () => {
    const { atelier } = await enDivergence();
    expect(await atelier.enregistrer({ ...fiche, definition: 'Autre définition.' })).toBe(true);
    expect(atelier.depot?.raison).toBe('pret');
    expect(atelier.divergence).toBe(true);
  });

  it('un réessai sans réseau la garde ; un réessai prêt l’efface', async () => {
    const { faux, atelier } = await enDivergence();
    faux.pannes.synchroniser = 'sans-reseau';
    await atelier.reessayer();
    expect(atelier.divergence).toBe(true);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: DIVERGENCE });
    delete faux.pannes.synchroniser;
    await atelier.reessayer();
    expect(atelier.divergence).toBe(false);
  });

  it('un envoi réussi l’efface ; un envoi refusé pour divergence la pose', async () => {
    const { faux, atelier } = await enDivergence();
    await atelier.enregistrer({ ...fiche, definition: 'Autre définition.' });
    await atelier.envoyer();
    expect(atelier.divergence).toBe(false);
    await atelier.enregistrer({ ...fiche, definition: 'Encore une autre.' });
    faux.pannes.envoyer = 'divergence';
    await atelier.envoyer();
    expect(atelier.divergence).toBe(true);
  });

  it('reprendre demande confirmation ; annuler ne reprend rien, confirmer reprend et efface la divergence', async () => {
    const { faux, atelier } = await enDivergence();
    atelier.demanderReprise();
    expect(atelier.demande?.genre).toBe('reprendre');
    atelier.annuler();
    expect(faux.appels).not.toContain('reprendre');

    atelier.demanderReprise();
    await atelier.confirmer();
    expect(faux.appels).toContain('reprendre');
    expect(atelier.divergence).toBe(false);
    expect(atelier.avis?.ton).toBe('calme');
  });

  for (const panne of ['sans-reseau', 'refus', 'erreur', 'rejet'] as const) {
    it(`une reprise qui échoue (${panne}) : l’échec est dit, la divergence reste, rien ne change`, async () => {
      const { faux, etat, atelier } = await enDivergence();
      const avant = etat.liste;
      faux.pannes.reprendre = panne;
      atelier.demanderReprise();
      await atelier.confirmer();
      expect(atelier.avis).toEqual({ ton: 'alerte', texte: REPRISE });
      expect(atelier.divergence).toBe(true);
      expect(atelier.disponible).toBe(true);
      expect(etat.liste).toBe(avant);
    });
  }
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
      expect(atelier.illisible).toBe(true);
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
      texte: 'La liste en ligne est reprise. Ta version est gardée ici\u202F:',
      chemin: faux.sauvegarde,
    });
  });

  it('le chemin du fichier mis de côté est gardé tel quel, apostrophe et points compris', async () => {
    const faux = new FauxPont('{"format":1,"publie":', ecrireFichier(locale));
    faux.sauvegarde = "C:\\Users\\O'Brien\\...\\mots-2026-11-24-153012.json";
    const { atelier } = await demarrerSur(faux);
    await atelier.reprendre();
    expect(atelier.avis?.chemin).toBe("C:\\Users\\O'Brien\\...\\mots-2026-11-24-153012.json");
    expect(atelier.avis?.texte).not.toContain('Brien');
  });

  it('reprendre sans fichier à mettre de côté : pas de chemin', async () => {
    const faux = new FauxPont(null, ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    await atelier.reprendre();
    expect(atelier.disponible).toBe(true);
    expect(atelier.avis).toEqual({ ton: 'calme', texte: 'La liste en ligne est reprise.' });
  });

  it('reprendre qui échoue : la copie reste illisible, l’échec est dit', async () => {
    const faux = new FauxPont('{"format":1,"publie":', ecrireFichier(locale));
    faux.pannes.reprendre = 'sans-reseau';
    const { atelier } = await demarrerSur(faux);
    await atelier.reprendre();
    expect(atelier.disponible).toBe(false);
    expect(atelier.illisible).toBe(true);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: REPRISE });
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

  it('une fiche qu’on ne peut préparer : faux et l’avis, sans lever d’erreur', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    await expect(atelier.enregistrer({ ...fiche, sources: undefined } as unknown as Mot)).resolves.toBe(false);
    expect(faux.enregistre).toHaveLength(0);
    expect(atelier.avis).toEqual({ ton: 'alerte', texte: ENREGISTREMENT });
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

  it('envoi est vrai dès la demande et jusqu’à la réponse', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    await atelier.enregistrer({ ...fiche, definition: 'Autre définition.' });
    expect(atelier.envoi).toBe(false);
    const enCours = atelier.envoyer();
    expect(atelier.envoi).toBe(true);
    await enCours;
    expect(atelier.envoi).toBe(false);
  });

  const pannes: [RaisonDepot | 'rejet', string][] = [
    ['sans-reseau', "Pas de réseau\u202F: la liste n'est pas partie. Tes modifications restent en attente."],
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

describe('la fiche en cours de saisie', () => {
  const ambages = mot('amb000', { mot: 'Sans ambages', tri: 'ambage', genre: 'loc. adv.' });
  const avecAmbages: FichierMots = { ...locale, mots: [...locale.mots, ambages] };

  it('nouveau : brouillon vide, à compléter ; le Tri suit le Mot tant qu’on ne le touche pas', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(locale)));
    atelier.nouveau();
    expect(atelier.brouillon).toMatchObject({ mot: '', tri: '', definition: '', sources: [], aCompleter: true });
    expect(locale.mots.some((m) => m.id === atelier.brouillon!.id)).toBe(false);
    atelier.saisirMot("S'abolir");
    expect(atelier.brouillon!.tri).toBe('abolir');
    atelier.saisirTri('abol');
    atelier.saisirMot("S'abolir encore");
    expect(atelier.brouillon!.tri).toBe('abol');
  });

  it('un mot enregistré dont le Tri n’est pas la proposition ne suit pas ; celui qui l’est suit', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecAmbages)));
    atelier.choisir(ambages.id);
    atelier.saisirMot('Sans ambages ni détours');
    expect(atelier.brouillon!.tri).toBe('ambage');

    atelier.saisirMot('Sans ambages');
    atelier.choisir(fiche.id);
    expect(atelier.demande).toBeNull();
    atelier.saisirMot('Vénustes');
    expect(atelier.brouillon!.tri).toBe('vénustes');
  });

  it('modifiee : faux après choisir, vrai après une frappe, faux une fois le texte remis', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(locale)));
    expect(atelier.modifiee).toBe(false);
    atelier.choisir(fiche.id);
    expect(atelier.brouillon).toEqual(fiche);
    expect(atelier.modifiee).toBe(false);
    atelier.brouillon!.definition += ' Et du charme.';
    expect(atelier.modifiee).toBe(true);
    atelier.brouillon!.definition = fiche.definition;
    expect(atelier.modifiee).toBe(false);
    atelier.brouillon!.sources = ['Sylvain Tesson: Géographie de l’instant (301)'];
    expect(atelier.modifiee).toBe(true);
    atelier.brouillon!.sources = [];
    atelier.brouillon!.aCompleter = true;
    expect(atelier.modifiee).toBe(true);
  });

  it('un mot nouveau est modifié dès qu’il a du texte, pas avant', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(locale)));
    atelier.nouveau();
    expect(atelier.modifiee).toBe(false);
    atelier.brouillon!.aCompleter = false;
    expect(atelier.modifiee).toBe(false);
    atelier.brouillon!.note = 'XX';
    expect(atelier.modifiee).toBe(true);
  });

  it('choisir un autre mot avec une fiche modifiée : la question, puis annuler garde le brouillon', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(locale)));
    atelier.choisir(fiche.id);
    atelier.saisirMot('Vénustissime');
    atelier.choisir('bbbbb1');
    expect(atelier.demande?.genre).toBe('quitter');
    expect(atelier.brouillon!.mot).toBe('Vénustissime');
    atelier.annuler();
    expect(atelier.demande).toBeNull();
    expect(atelier.brouillon!.mot).toBe('Vénustissime');
    expect(atelier.modifiee).toBe(true);
  });

  it('confirmer abandonne le brouillon et ouvre l’autre mot', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    atelier.saisirMot('Vénustissime');
    atelier.choisir('bbbbb1');
    atelier.confirmer();
    expect(atelier.demande).toBeNull();
    expect(atelier.brouillon!.id).toBe('bbbbb1');
    expect(atelier.modifiee).toBe(false);
    expect(etat.liste.mots.find((m) => m.id === fiche.id)!.mot).toBe('Vénuste');
    expect(faux.enregistre).toHaveLength(0);
  });

  it('nouveau avec une fiche modifiée pose aussi la question', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(locale)));
    atelier.choisir(fiche.id);
    atelier.saisirMot('Vénustissime');
    atelier.nouveau();
    expect(atelier.demande?.genre).toBe('quitter');
    atelier.confirmer();
    expect(atelier.brouillon).toMatchObject({ mot: '', aCompleter: true });
  });

  it('changer d’onglet avec une fiche modifiée pose la question ; confirmer change d’onglet', async () => {
    const { etat, atelier } = await demarrerSur(new FauxPont(ecrireFichier(locale)));
    etat.allerA('atelier');
    atelier.choisir(fiche.id);
    etat.allerA('recueil');
    expect(etat.ecran).toBe('recueil');

    etat.allerA('atelier');
    atelier.saisirMot('Vénustissime');
    etat.allerA('recueil');
    expect(etat.ecran).toBe('atelier');
    expect(atelier.demande?.genre).toBe('quitter');
    atelier.annuler();
    expect(etat.ecran).toBe('atelier');

    etat.allerA('reglages');
    atelier.confirmer();
    expect(etat.ecran).toBe('reglages');
    expect(atelier.modifiee).toBe(false);
    expect(etat.liste.mots.find((m) => m.id === fiche.id)!.mot).toBe('Vénuste');
  });

  it('demanderSuppression puis confirmer : le mot quitte etat.liste, plus de brouillon', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    atelier.demanderSuppression();
    expect(atelier.demande?.genre).toBe('supprimer');
    atelier.annuler();
    expect(etat.liste.mots.some((m) => m.id === fiche.id)).toBe(true);

    atelier.demanderSuppression();
    atelier.confirmer();
    await laisserFinir();
    expect(etat.liste.mots.some((m) => m.id === fiche.id)).toBe(false);
    expect(atelier.brouillon).toBeNull();
    expect(atelier.modifiee).toBe(false);
  });

  it('une question ouverte retient le changement d’onglet et reste telle quelle', async () => {
    const { etat, atelier } = await demarrerSur(new FauxPont(ecrireFichier(locale)));
    etat.allerA('atelier');
    atelier.choisir(fiche.id);
    atelier.demanderSuppression();
    etat.allerA('recueil');
    expect(etat.ecran).toBe('atelier');
    expect(atelier.demande?.genre).toBe('supprimer');

    atelier.annuler();
    atelier.saisirMot('Vénustissime');
    atelier.demanderSuppression();
    etat.allerA('quiz');
    expect(etat.ecran).toBe('atelier');
    expect(atelier.demande?.genre).toBe('supprimer');
    atelier.annuler();
    atelier.choisir('bbbbb1');
    expect(atelier.demande?.genre).toBe('quitter');
    etat.allerA('quiz');
    atelier.confirmer();
    expect(etat.ecran).toBe('atelier');
    expect(atelier.brouillon!.id).toBe('bbbbb1');
  });

  it('confirmer rend une promesse tenue une fois la suppression faite', async () => {
    const { etat, atelier } = await demarrerSur(new FauxPont(ecrireFichier(locale)));
    atelier.choisir(fiche.id);
    atelier.demanderSuppression();
    await atelier.confirmer();
    expect(etat.liste.mots.some((m) => m.id === fiche.id)).toBe(false);
    expect(atelier.brouillon).toBeNull();
  });

  it('enregistrer une fiche que rien n’a changée n’appelle pas le pont', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    expect(await atelier.enregistrerBrouillon()).toBe(true);
    expect(faux.appels).not.toContain('enregistrer');
    atelier.brouillon!.note = 'XX';
    expect(await atelier.enregistrerBrouillon()).toBe(true);
    expect(await atelier.enregistrerBrouillon()).toBe(true);
    expect(faux.enregistre).toHaveLength(1);
  });

  it('la définition du brouillon arrive à pont.enregistrer au caractère près', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    const definition = "  1. [Litt.]  Qui plaît ; EX: L'heure... \r\n2. US: rare  \n";
    atelier.nouveau();
    const id = atelier.brouillon!.id;
    atelier.saisirMot(' Vénustissime ');
    atelier.brouillon!.definition = definition;
    atelier.brouillon!.sources = [' Auteur: Titre (3) '];
    expect(await atelier.enregistrerBrouillon()).toBe(true);
    const ecrite = (JSON.parse(faux.enregistre.at(-1)!) as FichierMots).mots.find((m) => m.id === id)!;
    expect(ecrite).toMatchObject({ mot: 'Vénustissime', tri: 'vénustissime', definition, sources: [' Auteur: Titre (3) '] });
    expect(etat.liste.mots.find((m) => m.id === id)!.definition).toBe(definition);
    // Le brouillon devient la fiche enregistrée : plus rien à enregistrer.
    expect(atelier.brouillon).toEqual(ecrite);
    expect(atelier.modifiee).toBe(false);
  });

  it('un Tri vide est rempli par la proposition à l’enregistrement ; sans Mot, rien n’est enregistré', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { etat, atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    atelier.saisirTri('  ');
    expect(await atelier.enregistrerBrouillon()).toBe(true);
    expect(etat.liste.mots.find((m) => m.id === fiche.id)!.tri).toBe('vénuste');

    atelier.nouveau();
    atelier.saisirMot('  ');
    expect(await atelier.enregistrerBrouillon()).toBe(false);
    expect(faux.enregistre).toHaveLength(1);
  });

  it('enregistrement est vrai tant que l’enregistrement attend ou tourne ; la fiche reste modifiable', async () => {
    let lacher!: () => void;
    const faux = new FauxPont(ecrireFichier(locale));
    const { Atelier } = await lancer();
    const atelier = new Atelier(faux);
    await atelier.demarrer();
    // La synchronisation du lancement cale : l'enregistrement attend derrière elle.
    faux.retenue = new Promise((r) => (lacher = r));
    const synchro = atelier.reessayer();
    atelier.choisir(fiche.id);
    atelier.brouillon!.note = 'XX';
    expect(atelier.enregistrement).toBe(false);
    const enCours = atelier.enregistrerBrouillon();
    expect(atelier.enregistrement).toBe(true);
    await laisserFinir();
    expect(atelier.enregistrement).toBe(true);
    expect(faux.enregistre).toHaveLength(0);
    atelier.brouillon!.note = 'XXY';
    expect(atelier.brouillon!.note).toBe('XXY');
    lacher();
    await synchro;
    expect(await enCours).toBe(true);
    expect(atelier.enregistrement).toBe(false);
    expect(faux.enregistre).toHaveLength(1);
  });

  it('une frappe pendant l’enregistrement n’est pas perdue', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    const { atelier } = await demarrerSur(faux);
    atelier.choisir(fiche.id);
    atelier.brouillon!.note = 'XX';
    const enCours = atelier.enregistrerBrouillon();
    atelier.brouillon!.note = 'XXY';
    expect(await enCours).toBe(true);
    expect(atelier.brouillon!.note).toBe('XXY');
    expect(atelier.modifiee).toBe(true);
  });
});

describe('l’historique sur bureau', () => {
  it('note la liste envoyée : un envoi qui échoue ne laisse rien, le suivant montre tout ce qui part', async () => {
    const faux = new FauxPont(ecrireFichier(locale));
    // Sur bureau, l'état sait qu'un pont existe : il laisse l'atelier noter les listes.
    vi.doMock('./pont', () => ({ pont: faux }));
    try {
      const { etat, atelier } = await demarrerSur(faux);
      expect(etat.historique).toHaveLength(1);
      expect(etat.historique[0]).toMatchObject({ debut: true, publie: locale.publie, total: 3 });
      await atelier.enregistrer({ ...mot('nouveau1'), mot: 'Venelle', tri: 'venelle' });
      faux.pannes.envoyer = 'sans-reseau';
      await atelier.envoyer();
      expect(etat.historique).toHaveLength(1);
      delete faux.pannes.envoyer;
      await atelier.envoyer();
      expect(etat.historique).toHaveLength(2);
      expect(etat.historique[1]).toMatchObject({ debut: false, total: 4, ajoutes: [{ id: 'nouveau1', mot: 'Venelle' }] });
    } finally {
      vi.doUnmock('./pont');
    }
  });
});

describe('le vérificateur dans l’atelier', () => {
  // Une balise mal écrite, une espace double, un genre vide, une indication hors crochets.
  const bejaune = mot('bej001', { mot: 'Béjaune', tri: 'béjaune', genre: '', definition: '1. fauconnerie Oiseau jeune  qui ne sait pas voler. EX : Un béjaune.' });
  const avecBejaune: FichierMots = { ...locale, mots: [...locale.mots, bejaune] };
  const codes = (r: { code: string }[]) => r.map((x) => x.code);

  it('les remarques d’un mot ; un mot sans écart n’en a pas', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecBejaune)));
    expect(codes(atelier.remarques(bejaune))).toEqual(['balise', 'indication-hors-crochets', 'genre-vide', 'espaces']);
    expect(atelier.remarques(fiche)).toEqual([]);
  });

  it('les remarques de la fiche suivent le brouillon', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecBejaune)));
    expect(atelier.remarquesFiche).toEqual([]);
    atelier.choisir(bejaune.id);
    expect(codes(atelier.remarquesFiche)).toContain('genre-vide');
    atelier.brouillon!.genre = 'subst. masc.';
    expect(codes(atelier.remarquesFiche)).not.toContain('genre-vide');
  });

  it('corriger ne change que le brouillon ; deux corrections de suite partent du texte du moment', async () => {
    const faux = new FauxPont(ecrireFichier(avecBejaune));
    const { etat, atelier } = await demarrerSur(faux);
    atelier.choisir(bejaune.id);
    atelier.corriger('balise');
    expect(atelier.brouillon!.definition).toBe('1. fauconnerie Oiseau jeune  qui ne sait pas voler. EX: Un béjaune.');
    expect(atelier.modifiee).toBe(true);
    atelier.corriger('espaces');
    expect(atelier.brouillon!.definition).toBe('1. fauconnerie Oiseau jeune qui ne sait pas voler. EX: Un béjaune.');
    expect(codes(atelier.remarquesFiche)).toEqual(['indication-hors-crochets', 'genre-vide']);
    // Rien n'est écrit sans « Enregistrer ».
    expect(faux.enregistre).toEqual([]);
    expect(etat.liste.mots.find((m) => m.id === bejaune.id)!.definition).toBe(bejaune.definition);
    // Une remarque sans correction ne change rien.
    const avant = atelier.brouillon!.definition;
    atelier.corriger('genre-vide');
    expect(atelier.brouillon!.definition).toBe(avant);
  });

  it('« C’est voulu » tait la remarque pour ce mot, et c’est gardé', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecBejaune)));
    atelier.ignorer(bejaune.id, 'genre-vide');
    expect(codes(atelier.remarques(bejaune))).not.toContain('genre-vide');
    expect(codes(atelier.remarques({ ...bejaune, id: 'autre1' }))).toContain('genre-vide');
    expect(JSON.parse(localStorage.getItem('jolismots.verification.ignorees.v1')!)).toEqual(['bej001:genre-vide']);

    const relance = await demarrerSur(new FauxPont(ecrireFichier(avecBejaune)));
    expect(codes(relance.atelier.remarques(bejaune))).toEqual(['balise', 'indication-hors-crochets', 'espaces']);
  });

  it('À vérifier : les mots qui ont une remarque non tue', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecBejaune)));
    expect(atelier.aVerifier(bejaune)).toBe(true);
    expect(atelier.aVerifier(fiche)).toBe(false);
    for (const code of ['balise', 'indication-hors-crochets', 'genre-vide', 'espaces'] as const) atelier.ignorer(bejaune.id, code);
    expect(atelier.aVerifier(bejaune)).toBe(false);
  });
});

describe('les propositions de correction', () => {
  const abstrus = mot('abs001', { mot: 'Abstrus', tri: 'abstrus', genre: 'adj.', definition: 'Se dit d’une œuvre litt. ou artistique ou savante.', sources: ['Marc Lévy: Le roman (12)'] });
  const avecAbstrus: FichierMots = { ...locale, mots: [...locale.mots, abstrus] };
  const proposition = (extra: Record<string, string> = {}) => ({
    id: 'abs001',
    mot: 'Abstrus',
    champ: 'definition',
    avant: 'artistique ou',
    apres: 'artistiques ou',
    raison: 'accord au pluriel',
    certitude: 'forte',
    ...extra,
  });
  const fichier = JSON.stringify({
    format: 1,
    liste: '2026-11-25T03:49:19Z',
    propositions: [
      proposition(),
      proposition({ champ: 'sources', avant: 'Marc Lévy', apres: 'Marc Levy', raison: 'sans accent', certitude: 'faible' }),
      proposition({ id: 'disparu', mot: 'Disparu' }),
      proposition({ avant: 'introuvable' }),
    ],
  });

  it('un fichier illisible ne change rien et le dit', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecAbstrus)));
    expect(atelier.chargerPropositions('pas du JSON')).toBe(false);
    expect(atelier.avis?.ton).toBe('alerte');
    expect(atelier.propositionsDe(abstrus)).toEqual([]);
  });

  it('chargées : seules celles qui valent pour un mot de la liste se montrent, et le filtre les compte', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecAbstrus)));
    expect(atelier.aVerifier(abstrus)).toBe(false);
    expect(atelier.chargerPropositions(fichier)).toBe(true);
    expect(atelier.avis).toEqual({ ton: 'calme', texte: '2 propositions à traiter.' });
    expect(atelier.propositionsDe(abstrus).map((p) => p.champ)).toEqual(['definition', 'sources']);
    expect(atelier.aVerifier(abstrus)).toBe(true);
    expect(atelier.aVerifier(fiche)).toBe(false);
  });

  it('corriger applique au brouillon seul ; une fois enregistrée, elle est appliquée et ne revient pas', async () => {
    const faux = new FauxPont(ecrireFichier(avecAbstrus));
    const { etat, atelier } = await demarrerSur(faux);
    atelier.chargerPropositions(fichier);
    atelier.choisir(abstrus.id);
    const [def, source] = atelier.propositionsFiche;
    atelier.appliquerProposition(def!);
    expect(atelier.brouillon!.definition).toBe('Se dit d’une œuvre litt. ou artistiques ou savante.');
    expect(atelier.modifiee).toBe(true);
    expect(atelier.propositionsFiche).toEqual([source]);
    expect(faux.enregistre).toEqual([]);
    expect(etat.liste.mots.find((m) => m.id === abstrus.id)!.definition).toBe(abstrus.definition);
    atelier.appliquerProposition(source!);
    expect(atelier.brouillon!.sources).toEqual(['Marc Levy: Le roman (12)']);
    expect(atelier.propositionsFiche).toEqual([]);

    expect(await atelier.enregistrerBrouillon()).toBe(true);
    const gardees = JSON.parse(localStorage.getItem('jolismots.propositions.v1')!) as { sort: string }[];
    expect(gardees.map((p) => p.sort)).toEqual(['appliquee', 'appliquee', 'attente', 'attente']);
    expect(atelier.aVerifier(etat.liste.mots.find((m) => m.id === abstrus.id)!)).toBe(false);
  });

  it('une proposition appliquée au brouillon puis abandonnée reste en attente', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecAbstrus)));
    atelier.chargerPropositions(fichier);
    atelier.choisir(abstrus.id);
    atelier.appliquerProposition(atelier.propositionsFiche[0]!);
    atelier.choisir(fiche.id);
    await atelier.confirmer();
    atelier.choisir(abstrus.id);
    expect(atelier.propositionsFiche).toHaveLength(2);
  });

  it('« Non » la refuse : elle ne revient plus, même après un nouveau lancement ou le même fichier rechargé', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecAbstrus)));
    atelier.chargerPropositions(fichier);
    atelier.choisir(abstrus.id);
    atelier.refuserProposition(atelier.propositionsFiche[1]!);
    expect(atelier.propositionsFiche.map((p) => p.champ)).toEqual(['definition']);
    expect(atelier.modifiee).toBe(false);

    const relance = await demarrerSur(new FauxPont(ecrireFichier(avecAbstrus)));
    expect(relance.atelier.propositionsDe(abstrus).map((p) => p.champ)).toEqual(['definition']);
    relance.atelier.chargerPropositions(fichier);
    expect(relance.atelier.propositionsDe(abstrus).map((p) => p.champ)).toEqual(['definition']);
  });
});

describe('les propositions d’un second fichier', () => {
  const abstrus = mot('abs001', { mot: 'Abstrus', tri: 'abstrus', genre: 'adj.', definition: 'Se dit d’une œuvre litt. ou artistique ou savante.', sources: ['Marc Lévy: Le roman (12)'] });
  const avecAbstrus: FichierMots = { ...locale, mots: [...locale.mots, abstrus] };
  const definition = { id: 'abs001', mot: 'Abstrus', champ: 'definition', avant: 'artistique ou', apres: 'artistiques ou', raison: 'accord', certitude: 'forte' };
  const source = { ...definition, champ: 'sources', avant: 'Marc Lévy', apres: 'Marc Levy', raison: 'sans accent' };
  const genre = { ...definition, champ: 'genre', avant: 'adj.', apres: 'adj. et subst.', raison: 'emploi' };
  const fichier = (...propositions: object[]) => JSON.stringify({ format: 1, propositions });

  it('un refus reste acquis quand un autre fichier est chargé, puis le premier de nouveau', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecAbstrus)));
    atelier.chargerPropositions(fichier(definition, source));
    atelier.choisir(abstrus.id);
    atelier.refuserProposition(atelier.propositionsFiche.find((p) => p.champ === 'definition')!);
    atelier.chargerPropositions(fichier(genre));
    expect(atelier.propositionsDe(abstrus).map((p) => p.champ)).toEqual(['genre']);
    atelier.chargerPropositions(fichier(definition, source));
    expect(atelier.propositionsDe(abstrus).map((p) => p.champ)).toEqual(['sources']);
  });

  it('une proposition appliquée reste appliquée d’un fichier à l’autre', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecAbstrus)));
    atelier.chargerPropositions(fichier(definition));
    atelier.choisir(abstrus.id);
    atelier.appliquerProposition(atelier.propositionsFiche[0]!);
    await atelier.enregistrerBrouillon();
    atelier.chargerPropositions(fichier(genre));
    atelier.chargerPropositions(fichier(definition, genre));
    const gardees = JSON.parse(localStorage.getItem('jolismots.propositions.v1')!) as { champ: string; sort: string }[];
    expect(gardees.find((p) => p.champ === 'definition')?.sort).toBe('appliquee');
  });

  it('la correction de la définition peut passer par la zone de saisie (pour Ctrl+Z)', async () => {
    const { atelier } = await demarrerSur(new FauxPont(ecrireFichier(avecAbstrus)));
    atelier.chargerPropositions(fichier(definition, genre));
    atelier.choisir(abstrus.id);
    const ecrites: string[] = [];
    const ecrire = (t: string) => {
      ecrites.push(t);
      atelier.brouillon!.definition = t;
    };
    atelier.appliquerProposition(atelier.propositionsFiche.find((p) => p.champ === 'definition')!, ecrire);
    expect(ecrites).toEqual(['Se dit d’une œuvre litt. ou artistiques ou savante.']);
    // Le genre ne passe pas par la zone de la définition.
    atelier.appliquerProposition(atelier.propositionsFiche.find((p) => p.champ === 'genre')!, ecrire);
    expect(ecrites).toHaveLength(1);
    expect(atelier.brouillon!.genre).toBe('adj. et subst.');
    atelier.brouillon!.definition = 'Une définition  avec espace double.';
    atelier.corriger('espaces', ecrire);
    expect(ecrites[1]).toBe('Une définition avec espace double.');
  });
});
