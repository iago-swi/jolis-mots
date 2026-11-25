import {
  compterModifications,
  creerIdUnique,
  dater,
  ecrireFichier,
  messageDEnvoi,
  nettoyerFiche,
  nouvelleFiche,
  poserFiche,
  proposerTri,
  retirerFiche,
  validerFichier,
  validerPourEnvoi,
  type EtatDepot,
  type FichierMots,
  type FiltreAtelier,
  type Modifications,
  type Mot,
  type PontBureau,
  type RaisonDepot,
} from '@jolis-mots/core';
import { etat } from './etat.svelte';
import { pont } from './pont';

export interface Avis {
  ton: 'calme' | 'alerte';
  texte: string;
  /** Un chemin de fichier, montré tel quel sous le texte (jamais retouché à l'affichage). */
  chemin?: string;
}

const alerte = (texte: string): Avis => ({ ton: 'alerte', texte });
const calme = (texte: string): Avis => ({ ton: 'calme', texte });

const ENVOYEE = calme('Liste envoyée. Le téléphone la verra dans quelques minutes.');
const SANS_GIT = alerte("Git est introuvable sur cette machine. L'atelier en a besoin pour recevoir et envoyer la liste.");
const DIVERGENCE = alerte("La liste en ligne a changé ailleurs. Rien n'a été envoyé.");
const CONNEXION = alerte("L'atelier a besoin d'une connexion une première fois, pour recevoir la liste.");
const RECEPTION = alerte("L'atelier n'a pas pu recevoir la liste.");
const VERIFICATION = alerte("L'atelier n'a pas pu vérifier la liste en ligne. Tu peux continuer à travailler.");
const ILLISIBLE = alerte(
  "Le fichier des mots de l'atelier est illisible. Tu peux reprendre la liste en ligne ; ta version sera mise de côté.",
);
const REPRISE_ECHOUEE = alerte("La liste en ligne n'a pas pu être reprise. Rien n'a changé ici.");
const NON_ENREGISTREE = alerte("La fiche n'a pas pu être enregistrée.");
const ENVOI_ECHOUE = alerte("L'envoi a échoué. Tes modifications restent en attente.");

const ECHECS_D_ENVOI: Record<Exclude<RaisonDepot, 'pret'>, Avis> = {
  'sans-reseau': alerte("Pas de réseau : la liste n'est pas partie. Tes modifications restent en attente."),
  refus: alerte("GitHub a refusé l'envoi. Tes modifications restent en attente."),
  divergence: DIVERGENCE,
  erreur: ENVOI_ECHOUE,
  'sans-git': SANS_GIT,
};

/** Les avis sur l'état de la copie : une synchronisation réussie les rend caducs. */
const AVIS_DE_LA_COPIE: readonly Avis[] = [
  SANS_GIT,
  DIVERGENCE,
  CONNEXION,
  RECEPTION,
  VERIFICATION,
  ILLISIBLE,
  REPRISE_ECHOUEE,
];

/** Le texte de l'avis de divergence, que l'écran garde affiché tant qu'elle n'est pas réglée. */
export const TEXTE_DIVERGENCE = DIVERGENCE.texte;

/** Une confirmation en attente : quitter une fiche modifiée, supprimer un mot, ou reprendre la liste en ligne. */
export interface Demande {
  genre: 'quitter' | 'supprimer' | 'reprendre';
  /** Ce que fait le oui ; une promesse quand il écrit (la suppression). */
  suite: () => void | Promise<unknown>;
}

const AUCUNE: Modifications = { ajoutes: 0, modifies: 0, supprimes: 0, total: 0 };

/** Le texte d'un mots.json, s'il se lit et a la bonne forme ; sinon null. */
function lireListe(texte: string | null): FichierMots | null {
  if (texte === null) return null;
  try {
    return validerFichier(JSON.parse(texte));
  } catch {
    return null;
  }
}

/** La fiche avec ses seuls champs, dans l'ordre du fichier : rien d'autre n'arrive dans mots.json. */
function ranger(m: Mot): Mot {
  return {
    id: m.id,
    mot: m.mot,
    tri: m.tri,
    genre: m.genre,
    definition: m.definition,
    sources: [...m.sources],
    note: m.note,
    util: m.util,
    aCompleter: m.aCompleter,
  };
}

/** Les deux fiches portent les mêmes champs, au caractère près. */
function memesFiches(a: Mot, b: Mot): boolean {
  return JSON.stringify(ranger(a)) === JSON.stringify(ranger(b));
}

/** Une fiche nouvelle a du texte dans au moins un champ. */
function aDuTexte(m: Mot): boolean {
  return [m.mot, m.tri, m.genre, m.definition, m.note, m.util].some((t) => t !== '') || m.sources.length > 0;
}

/**
 * L'atelier, sur bureau : la copie locale des mots (lue et écrite par le pont), le compteur
 * de modifications et les avis. La liste de travail est `etat.liste`, que lisent aussi les écrans
 * de lecture. Les opérations passent une à une, dans l'ordre où elles sont demandées.
 */
export class Atelier {
  depot = $state<EtatDepot | null>(null);
  occupe = $state(false);
  avis = $state<Avis | null>(null);
  /**
   * La liste en ligne a changé ailleurs, et ce n'est pas réglé : posé par toute réponse
   * « divergence », levé par une reprise, un envoi ou une synchronisation réussis.
   */
  divergence = $state(false);
  /** Un envoi est demandé et n'a pas encore sa réponse. */
  envoi = $state(false);
  /** Un enregistrement de la fiche attend son tour ou tourne. */
  enregistrement = $state(false);
  /** L'ouverture de la copie a échoué : son absence ne tient peut-être pas au réseau. */
  private ouvertureRatee = false;
  /** La liste locale lue dans `depot.locale`, null si elle manque ou ne se lit pas. */
  private locale = $state.raw<FichierMots | null>(null);
  /** La dernière liste envoyée ou reçue, lue dans `depot.envoyee`. */
  private envoyee = $state.raw<FichierMots | null>(null);

  /** Une copie locale existe et se lit. */
  readonly disponible: boolean = $derived(this.locale !== null);
  /** Une copie existe mais son fichier des mots manque ou ne se lit pas : rien ne doit l'écraser. */
  readonly illisible: boolean = $derived(
    !this.disponible && this.depot !== null && (this.depot.locale !== null || this.depot.envoyee !== null),
  );
  /**
   * Le message de git, en anglais, quand la dernière opération a échoué. Il ne se montre que
   * sous un avis d'alerte, qui dit en français ce qui s'est passé : une panne que l'atelier
   * tait (pas de réseau, avec une copie) ne laisse pas de ligne anglaise orpheline.
   */
  readonly detail: string = $derived(
    this.avis?.ton === 'alerte' && this.depot !== null && this.depot.raison !== 'pret' ? this.depot.detail.trim() : '',
  );
  /** Entre la liste envoyée et `etat.liste`. */
  readonly modifications: Modifications = $derived(
    this.disponible ? compterModifications(this.envoyee?.mots ?? [], etat.liste.mots) : AUCUNE,
  );

  /** Filtre et recherche de la liste de l'atelier. */
  filtre = $state<FiltreAtelier>('tous');
  requete = $state('');
  /** La fiche en cours de saisie ; null quand aucun mot n'est choisi. */
  brouillon = $state<Mot | null>(null);
  /** Confirmation en attente. */
  demande = $state<Demande | null>(null);
  /** Le mot tel qu'il est enregistré ; null pour un mot nouveau. */
  private origine = $state.raw<Mot | null>(null);
  /** Le Tri suit la proposition tirée du Mot. */
  private triSuit = false;

  /** Le brouillon diffère du mot enregistré, ou c'est un mot nouveau qui a du texte. */
  readonly modifiee: boolean = $derived.by(() => {
    const b = this.brouillon;
    if (b === null) return false;
    return this.origine === null ? aDuTexte(b) : !memesFiches(b, this.origine);
  });

  private file: Promise<unknown> = Promise.resolve();
  private enCours = 0;

  constructor(private readonly pont: PontBureau) {
    // Changer d'onglet avec une fiche modifiée pose la question de l'atelier.
    etat.retenirSortie = (suite) => this.retenir(suite);
  }

  /** Met `operation` à la suite des autres ; `occupe` reste vrai tant qu'il en reste. */
  private enFile<T>(operation: () => Promise<T>): Promise<T> {
    this.enCours++;
    this.occupe = true;
    const suite = this.file.then(operation).finally(() => {
      if (--this.enCours === 0) this.occupe = false;
    });
    this.file = suite.catch(() => undefined);
    return suite;
  }

  /** Appelle le pont ; une promesse rejetée compte comme une erreur, sur la copie telle qu'on la connaît. */
  private async appeler(f: () => Promise<EtatDepot>): Promise<EtatDepot> {
    try {
      return await f();
    } catch (e) {
      const connu = this.depot ?? { locale: null, envoyee: null };
      return {
        raison: 'erreur',
        detail: e instanceof Error ? e.message : String(e),
        locale: connu.locale,
        envoyee: connu.envoyee,
        sauvegarde: null,
      };
    }
  }

  /** Retient le nouvel état ; si le texte local a changé et se lit, les écrans le prennent. */
  private poser(r: EtatDepot): void {
    const avant = this.depot;
    this.depot = r;
    if (r.raison === 'divergence') this.divergence = true;
    if (avant === null || r.envoyee !== avant.envoyee) this.envoyee = lireListe(r.envoyee);
    if (avant === null || r.locale !== avant.locale) {
      this.locale = lireListe(r.locale);
      if (this.locale !== null) etat.remplacerListe(this.locale);
    }
  }

  /** L'avis sur la copie après l'avoir reçue, vérifiée ou reprise ; null quand il n'y a rien à dire. */
  private avisDeLaCopie(raison: RaisonDepot): Avis | null {
    if (raison === 'sans-git') return SANS_GIT;
    if (this.illisible) return ILLISIBLE;
    if (!this.disponible) {
      if (raison === 'pret') return null;
      // « Une première fois » seulement quand c'est le réseau qui manque, pas quand l'ouverture a raté.
      return raison === 'sans-reseau' && !this.ouvertureRatee ? CONNEXION : RECEPTION;
    }
    return raison === 'divergence' ? DIVERGENCE : null;
  }

  /** Ouvre la copie locale et pose sa liste ; puis va voir la liste en ligne, sans attendre. */
  async demarrer(): Promise<void> {
    await this.enFile(async () => {
      const r = await this.appeler(() => this.pont.ouvrir());
      this.ouvertureRatee = r.raison !== 'pret';
      this.poser(r);
      // Pas d'alarme pendant la première synchronisation : elle va peut-être télécharger la copie.
      this.avis = this.illisible ? ILLISIBLE : null;
    });
    this.reessayer().catch(() => undefined);
  }

  /**
   * Synchronise : télécharge la copie si elle manque, sinon va voir la liste en ligne. Sans rien
   * à dire, l'avis en place reste (un envoi échoué le reste), sauf un avis sur la copie que
   * la réussite rend caduc.
   */
  reessayer(): Promise<void> {
    return this.enFile(async () => {
      const r = await this.appeler(() => this.pont.synchroniser());
      this.poser(r);
      if (r.raison === 'pret') this.divergence = false;
      const nouveau =
        this.avisDeLaCopie(r.raison) ??
        // Avec une copie, une panne de réseau ne se dit pas : l'atelier travaille hors ligne.
        (r.raison === 'refus' || r.raison === 'erreur' ? VERIFICATION : null);
      if (nouveau !== null) this.avis = nouveau;
      else if (r.raison === 'pret' && AVIS_DE_LA_COPIE.some((a) => a.texte === this.avis?.texte)) this.avis = null;
    });
  }

  /** Écrit `liste` dans la copie locale ; vrai si c'est fait. */
  private async ecrire(liste: FichierMots): Promise<boolean> {
    const r = await this.appeler(() => this.pont.enregistrer(ecrireFichier(liste)));
    this.poser(r);
    const fait = r.raison === 'pret' && this.disponible;
    this.avis = fait ? null : this.illisible ? ILLISIBLE : NON_ENREGISTREE;
    return fait;
  }

  /** Enregistre la fiche (Mot et Tri sans espaces aux bords, le reste tel quel). */
  enregistrer(f: Mot): Promise<boolean> {
    let fiche: Mot;
    try {
      fiche = ranger(nettoyerFiche(f));
    } catch {
      return this.enFile(async () => {
        if (this.disponible) this.avis = NON_ENREGISTREE;
        return false;
      });
    }
    return this.enFile(async () => {
      if (!this.disponible) return false;
      return this.ecrire({ ...etat.liste, mots: poserFiche(etat.liste.mots, fiche) });
    });
  }

  supprimer(id: string): Promise<boolean> {
    return this.enFile(async () => {
      if (!this.disponible) return false;
      return this.ecrire({ ...etat.liste, mots: retirerFiche(etat.liste.mots, id) });
    });
  }

  /** Contrôle la liste, la date et l'envoie ; sans rien envoyer si elle est fautive. */
  envoyer(): Promise<void> {
    this.envoi = true;
    return this.enFile(async () => {
      if (!this.disponible) return;
      const phrases = validerPourEnvoi(etat.liste);
      if (phrases.length > 0) {
        this.avis = alerte(phrases.join(' '));
        return;
      }
      const maintenant = new Date();
      const message = messageDEnvoi(this.modifications, maintenant);
      const texte = ecrireFichier(dater(etat.liste, maintenant));
      const r = await this.appeler(() => this.pont.envoyer(texte, message));
      this.poser(r);
      if (r.raison === 'pret') this.divergence = false;
      if (this.illisible) this.avis = ILLISIBLE;
      else this.avis = r.raison === 'pret' ? ENVOYEE : ECHECS_D_ENVOI[r.raison];
    }).finally(() => {
      this.envoi = false;
    });
  }

  /** Met la version locale de côté et reprend la liste en ligne. */
  reprendre(): Promise<void> {
    return this.enFile(async () => {
      const r = await this.appeler(() => this.pont.reprendre());
      this.poser(r);
      if (r.raison === 'pret' && this.disponible) {
        this.divergence = false;
        this.avis =
          r.sauvegarde === null
            ? calme('La liste en ligne est reprise.')
            : { ...calme('La liste en ligne est reprise. Ta version est gardée ici :'), chemin: r.sauvegarde };
      } else if (r.raison !== 'pret') {
        // La copie et la divergence restent telles quelles ; l'échec est dit.
        this.avis = REPRISE_ECHOUEE;
      } else {
        this.avis = this.avisDeLaCopie(r.raison) ?? this.avis;
      }
    });
  }

  /** Un identifiant que ne porte aucun mot, ni ici ni dans la liste envoyée. */
  idNeuf(): string {
    return creerIdUnique([...etat.liste.mots, ...(this.envoyee?.mots ?? [])].map((m) => m.id));
  }

  /** Ouvre une fiche : `origine` est le mot enregistré (null pour un mot nouveau), `brouillon` ce qu'on saisit. */
  private ouvrir(origine: Mot | null, brouillon: Mot): void {
    this.origine = origine;
    this.brouillon = { ...brouillon, sources: [...brouillon.sources] };
    this.triSuit = origine === null || origine.tri === proposerTri(origine.mot);
  }

  /** Fait `suite` tout de suite, ou après la question si la fiche est modifiée. */
  private apresQuestion(suite: () => void): void {
    if (this.modifiee) this.demande = { genre: 'quitter', suite };
    else suite();
  }

  /**
   * Pour `etat.allerA` : retient la sortie de l'écran tant qu'une question est ouverte (elle reste
   * telle quelle), ou quand la fiche est modifiée (la question est posée).
   */
  private retenir(suite: () => void): boolean {
    if (this.demande !== null) return true;
    if (!this.modifiee) return false;
    this.demande = { genre: 'quitter', suite };
    return true;
  }

  /** Ouvre le mot `id` dans la fiche. */
  choisir(id: string): void {
    if (this.brouillon?.id === id) return;
    this.apresQuestion(() => {
      const m = etat.liste.mots.find((x) => x.id === id);
      if (m !== undefined) this.ouvrir(m, m);
    });
  }

  /** Une fiche vide, « À compléter » cochée. */
  nouveau(): void {
    this.apresQuestion(() => this.ouvrir(null, nouvelleFiche(this.idNeuf())));
  }

  saisirMot(texte: string): void {
    if (this.brouillon === null) return;
    this.brouillon.mot = texte;
    if (this.triSuit) this.brouillon.tri = proposerTri(texte);
  }

  saisirTri(texte: string): void {
    if (this.brouillon === null) return;
    this.brouillon.tri = texte;
    this.triSuit = false;
  }

  /**
   * Enregistre le brouillon ; un Tri vide reçoit la proposition. Une fois écrit, le brouillon devient
   * la fiche enregistrée, sauf si une frappe l'a changé entre-temps.
   */
  async enregistrerBrouillon(): Promise<boolean> {
    if (this.brouillon === null || this.brouillon.mot.trim() === '') return false;
    // Rien de changé : rien à écrire.
    if (!this.modifiee) return true;
    const envoye = ranger(this.brouillon);
    const fiche = envoye.tri.trim() === '' ? { ...envoye, tri: proposerTri(envoye.mot) } : envoye;
    // Derrière une synchronisation lente, l'enregistrement peut attendre : l'écran le dit.
    this.enregistrement = true;
    let fait: boolean;
    try {
      fait = await this.enregistrer(fiche);
    } finally {
      this.enregistrement = false;
    }
    if (!fait) return false;
    const enregistree = etat.liste.mots.find((m) => m.id === fiche.id);
    if (enregistree === undefined || this.brouillon?.id !== fiche.id) return true;
    if (memesFiches(this.brouillon, envoye)) this.ouvrir(enregistree, enregistree);
    else this.origine = enregistree;
    return true;
  }

  /** Demande confirmation avant de supprimer le mot choisi (un mot jamais enregistré n'a rien à supprimer). */
  demanderSuppression(): void {
    const origine = this.origine;
    if (origine === null) return;
    this.demande = {
      genre: 'supprimer',
      suite: () =>
        this.supprimer(origine.id)
          .then((fait) => {
            if (fait && this.brouillon?.id === origine.id) {
              this.brouillon = null;
              this.origine = null;
            }
          })
          .catch(() => undefined),
    };
  }

  /** Demande confirmation avant de mettre la version locale de côté et de reprendre la liste en ligne. */
  demanderReprise(): void {
    this.demande = { genre: 'reprendre', suite: () => this.reprendre().catch(() => undefined) };
  }

  /**
   * Répond oui à la question : la fiche modifiée est abandonnée avant de quitter. La promesse est
   * tenue quand la suite est faite (la suppression écrite, ou non).
   */
  confirmer(): Promise<void> {
    const d = this.demande;
    if (d === null) return Promise.resolve();
    this.demande = null;
    if (d.genre === 'quitter') {
      if (this.origine === null) this.brouillon = null;
      else this.ouvrir(this.origine, this.origine);
    }
    return Promise.resolve(d.suite()).then(() => undefined);
  }

  annuler(): void {
    this.demande = null;
  }
}

/** L'atelier, sur bureau seulement. */
export const atelier: Atelier | null = pont === null ? null : new Atelier(pont);
