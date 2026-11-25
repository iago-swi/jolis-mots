import {
  appliquable,
  appliquer,
  cleProposition,
  compterModifications,
  creerIdUnique,
  dater,
  ecrireFichier,
  estComplet,
  indicationsConnues,
  lireProposition,
  lirePropositions,
  messageDEnvoi,
  motsAVerifier,
  motsInconnus,
  nettoyerFiche,
  nouvelleFiche,
  poserFiche,
  proposerTri,
  remarqueOrthographe,
  retirerFiche,
  validerFichier,
  validerHistorique,
  validerPourEnvoi,
  verifierMot,
  type CodeRemarque,
  type EntreeHistorique,
  type EtatDepot,
  type FichierMots,
  type FiltreAtelier,
  type Modifications,
  type Mot,
  type PontBureau,
  type Proposition,
  type RaisonDepot,
  type Remarque,
} from '@jolis-mots/core';
import { etat } from './etat.svelte';
import { pont } from './pont';
import { ecrire, lire } from './stockage';

/** Les remarques tues (« C'est voulu »), sur cet ordinateur : une liste de `id:code`. */
const CLE_IGNOREES = 'jolismots.verification.ignorees.v1';
/** Les propositions de correction chargées, chacune avec son sort. */
const CLE_PROPOSITIONS = 'jolismots.propositions.v1';

/** Le nombre de mots demandés au dictionnaire en une fois. */
const LOT_ORTHOGRAPHE = 400;
/** L'attente avant de demander des mots : une frappe qui suit la repousse. */
const ATTENTE_ORTHOGRAPHE = 300;

/** Le sort d'une proposition : en attente, appliquée (et enregistrée), ou refusée. */
export type SortProposition = 'attente' | 'appliquee' | 'refusee';
type PropositionSuivie = Proposition & { sort: SortProposition };

const SORTS: readonly string[] = ['attente', 'appliquee', 'refusee'];

/** Les propositions gardées, contrôlées une à une ; une entrée illisible est écartée. */
function lirePropositionsGardees(): PropositionSuivie[] {
  const brut = lire<unknown>(CLE_PROPOSITIONS, []);
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((e: unknown) => {
    const p = lireProposition(e);
    const sort = (e as { sort?: unknown }).sort;
    return p !== null && typeof sort === 'string' && SORTS.includes(sort) ? [{ ...p, sort: sort as SortProposition }] : [];
  });
}

function lireIgnorees(): Set<string> {
  const brut = lire<unknown>(CLE_IGNOREES, []);
  return new Set(Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : []);
}

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
  "Le fichier des mots de l'atelier est illisible. Tu peux reprendre la liste en ligne\u202F; ta version sera mise de côté.",
);
const REPRISE_ECHOUEE = alerte("La liste en ligne n'a pas pu être reprise. Rien n'a changé ici.");
const NON_ENREGISTREE = alerte("La fiche n'a pas pu être enregistrée.");
const ENVOI_ECHOUE = alerte("L'envoi a échoué. Tes modifications restent en attente.");
const ENVOYEE_INCONNUE = alerte(
  "L'atelier ne trouve pas la dernière liste envoyée\u202F: il ne peut ni compter les modifications ni envoyer.",
);
/** Dit avec le chemin du mots.json de l'ancienne copie, que la synchronisation a mise de côté. */
const MISE_DE_COTE = calme("L'ancienne copie de l'atelier a été mise de côté ici\u202F:");

const ECHECS_D_ENVOI: Record<Exclude<RaisonDepot, 'pret'>, Avis> = {
  'sans-reseau': alerte("Pas de réseau\u202F: la liste n'est pas partie. Tes modifications restent en attente."),
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
  ENVOYEE_INCONNUE,
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
  #avis = $state<Avis | null>(null);
  /** Le message de git de l'opération qui a posé l'avis d'alerte en place. */
  #detailDeLAvis = $state('');
  /** L'avis en place. Une alerte retient le message de git du moment où elle est posée. */
  get avis(): Avis | null {
    return this.#avis;
  }
  set avis(a: Avis | null) {
    if (a === this.#avis) return;
    const enPanne = this.depot !== null && this.depot.raison !== 'pret';
    this.#detailDeLAvis = a?.ton === 'alerte' && enPanne ? this.depot!.detail.trim() : '';
    this.#avis = a;
  }
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
   * Le message de git, en anglais, de l'échec qu'une alerte raconte. Il ne se montre que
   * sous un avis d'alerte, qui dit en français ce qui s'est passé : une panne que l'atelier
   * tait (pas de réseau, avec une copie) ne laisse pas de ligne anglaise orpheline, ni ne
   * remplace le message de l'alerte encore en place.
   */
  readonly detail: string = $derived(this.#avis?.ton === 'alerte' ? this.#detailDeLAvis : '');
  /**
   * La dernière liste envoyée est connue. Sans elle (git introuvable, branche en ligne absente
   * de la copie), rien n'est compté ni envoyé : un compte contre une liste vide serait faux.
   */
  readonly envoyeeConnue: boolean = $derived(this.envoyee !== null);
  /** Entre la liste envoyée et `etat.liste`. */
  readonly modifications: Modifications = $derived(
    this.disponible && this.envoyee !== null ? compterModifications(this.envoyee.mots, etat.liste.mots) : AUCUNE,
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

  /** Les indications connues du vérificateur, tirées une fois par liste. */
  private readonly connues: Set<string> = $derived(indicationsConnues(etat.liste.mots));
  /** Les remarques tues, `id:code`. */
  private ignorees = $state.raw<ReadonlySet<string>>(lireIgnorees());
  /** Les propositions chargées, avec leur sort. */
  private suivies = $state.raw<readonly PropositionSuivie[]>(lirePropositionsGardees());
  /** Les propositions en attente, par mot. */
  private readonly enAttente: ReadonlyMap<string, Proposition[]> = $derived.by(() => {
    const parMot = new Map<string, Proposition[]>();
    for (const p of this.suivies) if (p.sort === 'attente') parMot.set(p.id, [...(parMot.get(p.id) ?? []), p]);
    return parMot;
  });
  /** Les clés des propositions appliquées au brouillon : elles deviennent « appliquées » quand il est enregistré. */
  private appliqueesAuBrouillon = new Set<string>();

  /**
   * Ce que le dictionnaire a dit de chaque mot demandé : vrai pour un mot inconnu. Un mot absent
   * n'a pas encore de réponse. Les réponses arrivent par lots, en arrière-plan.
   */
  private dictionnaire = $state.raw<ReadonlyMap<string, boolean>>(new Map());
  /** Les mots à demander, dans l'ordre (ceux de la fiche en tête), et ceux qui sont partis. */
  private aDemander = new Set<string>();
  private enDemande = new Set<string>();
  private minuterieOrthographe: ReturnType<typeof setTimeout> | null = null;
  private orthographeEnCours = false;
  /** Le dictionnaire a échoué : il n'est plus sollicité, et rien n'est signalé. */
  private dictionnaireEnPanne = false;

  /** Les mots de la liste qui ont une remarque du vérificateur non tue ou une proposition en attente, une fois par liste. */
  private readonly idsVerifies: ReadonlySet<string> = $derived(
    new Set(
      etat.liste.mots.filter((m) => this.remarquesDuVerificateur(m).length > 0 || this.propositionsDe(m).length > 0).map((m) => m.id),
    ),
  );
  /** Les mots de la liste qui ont un mot inconnu non tu ; refait à chaque lot de réponses. */
  private readonly idsOrthographe: ReadonlySet<string> = $derived(
    new Set(etat.liste.mots.filter((m) => this.inconnusDe(m, false).length > 0).map((m) => m.id)),
  );
  private readonly idsAVerifier: ReadonlySet<string> = $derived(new Set([...this.idsVerifies, ...this.idsOrthographe]));
  /** Pour le filtre « À vérifier » : le mot de la liste a une remarque ou une proposition à traiter. */
  readonly aVerifier = (m: Mot): boolean => this.idsAVerifier.has(m.id);

  /** Les remarques du brouillon, refaites à chaque frappe. */
  readonly remarquesFiche: Remarque[] = $derived(this.brouillon === null ? [] : this.remarquesDe(this.brouillon, true));
  /** Les propositions en attente qui valent pour le brouillon tel qu'il est. */
  readonly propositionsFiche: Proposition[] = $derived(this.brouillon === null ? [] : this.propositionsDe(this.brouillon));

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

  /**
   * Retient le nouvel état ; si le texte local a changé et se lit, les écrans le prennent.
   * Vrai quand la liste de travail a été remplacée.
   */
  private poser(r: EtatDepot): boolean {
    const avant = this.depot;
    this.depot = r;
    if (r.raison === 'divergence') this.divergence = true;
    if (avant === null || r.envoyee !== avant.envoyee) {
      this.envoyee = lireListe(r.envoyee);
      // L'historique note la liste envoyée (ou reçue), jamais la copie de travail : un envoi qui
      // échoue ne laisse pas d'entrée, et une entrée montre tout ce qu'un envoi a fait partir.
      if (this.envoyee !== null) etat.noterListe(this.envoyee);
    }
    if (avant === null || r.locale !== avant.locale) {
      this.locale = lireListe(r.locale);
      if (this.locale !== null) {
        etat.remplacerListe(this.locale);
        return true;
      }
    }
    return false;
  }

  /**
   * Après une liste reçue ou reprise : une fiche non modifiée prend le mot de la nouvelle liste
   * (ou se ferme s'il n'y est plus) ; une fiche modifiée reste telle quelle, comparée désormais
   * au mot de la nouvelle liste.
   */
  private rafraichirFiche(): void {
    const b = this.brouillon;
    if (b === null) return;
    const enregistre = etat.liste.mots.find((m) => m.id === b.id) ?? null;
    if (this.modifiee) {
      this.origine = enregistre;
    } else if (enregistre !== null) {
      this.ouvrir(enregistre, enregistre);
    } else if (this.origine !== null) {
      // Un mot nouveau encore vide n'était pas dans la liste : il reste ouvert.
      this.brouillon = null;
      this.origine = null;
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
    if (raison === 'divergence') return DIVERGENCE;
    return this.envoyee === null ? ENVOYEE_INCONNUE : null;
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
      if (this.poser(r)) this.rafraichirFiche();
      if (r.raison === 'pret') this.divergence = false;
      const nouveau =
        this.avisDeLaCopie(r.raison) ??
        // Avec une copie, une panne de réseau ne se dit pas : l'atelier travaille hors ligne.
        (r.raison === 'refus' || r.raison === 'erreur' ? VERIFICATION : null);
      if (r.sauvegarde !== null) {
        // Une ancienne copie a été mise de côté : son chemin est dit, avec l'avis du moment s'il y en a un.
        this.avis =
          nouveau === null
            ? { ...MISE_DE_COTE, chemin: r.sauvegarde }
            : { ton: nouveau.ton, texte: `${nouveau.texte} ${MISE_DE_COTE.texte}`, chemin: r.sauvegarde };
      } else if (nouveau !== null) this.avis = nouveau;
      else if (r.raison === 'pret' && AVIS_DE_LA_COPIE.some((a) => this.avis?.texte.startsWith(a.texte))) {
        // Un avis sur la copie, seul ou suivi de la mise de côté, est caduc ; le chemin, lui, reste dit.
        const chemin = this.avis?.chemin;
        this.avis = chemin === undefined ? null : { ...MISE_DE_COTE, chemin };
      }
    });
  }

  /** Écrit `liste` dans la copie locale ; vrai si c'est fait. */
  private async ecrire(liste: FichierMots): Promise<boolean> {
    const r = await this.appeler(() => this.pont.enregistrer(ecrireFichier(liste)));
    this.poser(r);
    const fait = r.raison === 'pret' && this.disponible;
    if (fait) this.avis = this.envoyee === null ? ENVOYEE_INCONNUE : null;
    else this.avis = this.illisible ? ILLISIBLE : NON_ENREGISTREE;
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
      if (!this.disponible || this.envoyee === null) return;
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
      if (this.poser(r)) this.rafraichirFiche();
      if (r.raison === 'pret' && this.disponible) {
        this.divergence = false;
        this.avis =
          r.sauvegarde === null
            ? calme('La liste en ligne est reprise.')
            : { ...calme('La liste en ligne est reprise. Ta version est gardée ici\u202F:'), chemin: r.sauvegarde };
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
    this.appliqueesAuBrouillon = new Set();
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
    if (enregistree !== undefined) {
      // Les propositions appliquées au brouillon, et que le mot enregistré porte bien, sont faites.
      const faites = this.suivies.filter((p) => this.appliqueesAuBrouillon.has(cleProposition(p)) && p.id === fiche.id && !appliquable(p, enregistree));
      if (faites.length > 0) this.trancher(new Set(faites.map(cleProposition)), 'appliquee');
    }
    if (enregistree === undefined || this.brouillon?.id !== fiche.id) return true;
    if (memesFiches(this.brouillon, envoye)) this.ouvrir(enregistree, enregistree);
    else this.origine = enregistree;
    return true;
  }

  /** Les remarques du vérificateur sur ce mot, sans celles qui sont tues ; les mots inconnus du dictionnaire en dernier. */
  remarques(m: Mot): Remarque[] {
    return this.remarquesDe(m, false);
  }

  private remarquesDe(m: Mot, prioritaire: boolean): Remarque[] {
    const orthographe = remarqueOrthographe(this.inconnusDe(m, prioritaire));
    return orthographe === null ? this.remarquesDuVerificateur(m) : [...this.remarquesDuVerificateur(m), orthographe];
  }

  private remarquesDuVerificateur(m: Mot): Remarque[] {
    return verifierMot(m, this.connues).filter((r) => !this.ignorees.has(`${m.id}:${r.code}`));
  }

  /**
   * Les mots inconnus du dictionnaire dans la définition d'un mot complet, sans ceux qui sont tus.
   * Les mots sans réponse encore sont demandés en arrière-plan (en tête de file pour la fiche) :
   * la remarque viendra avec la réponse. Rien n'attend ici.
   */
  private inconnusDe(m: Mot, prioritaire: boolean): string[] {
    if (!estComplet(m) || this.dictionnaireEnPanne) return [];
    const dico = this.dictionnaire;
    const manquants = motsAVerifier(m.definition).filter((w) => !dico.has(w) && !this.enDemande.has(w));
    if (manquants.length > 0) this.demanderMots(manquants, prioritaire);
    return motsInconnus(m.definition, (w) => dico.get(w), m.mot).filter((w) => !this.ignorees.has(`${m.id}:orthographe:${w}`));
  }

  /**
   * Met des mots dans la file du dictionnaire. Peut être appelée pendant un calcul de l'écran :
   * elle ne touche à aucun état ; les réponses arrivent plus tard.
   */
  private demanderMots(mots: string[], enTete: boolean): void {
    if (enTete) this.aDemander = new Set([...mots, ...this.aDemander]);
    else for (const w of mots) this.aDemander.add(w);
    if (this.orthographeEnCours) return;
    if (this.minuterieOrthographe !== null) clearTimeout(this.minuterieOrthographe);
    this.minuterieOrthographe = setTimeout(() => {
      this.minuterieOrthographe = null;
      void this.demanderAuDictionnaire();
    }, ATTENTE_ORTHOGRAPHE);
  }

  /** Vide la file, lot après lot ; chaque lot de réponses met les remarques à jour. */
  private async demanderAuDictionnaire(): Promise<void> {
    if (this.orthographeEnCours) return;
    this.orthographeEnCours = true;
    try {
      while (this.aDemander.size > 0 && !this.dictionnaireEnPanne) {
        const lot = [...this.aDemander].slice(0, LOT_ORTHOGRAPHE);
        for (const w of lot) {
          this.aDemander.delete(w);
          this.enDemande.add(w);
        }
        let inconnus: Set<string>;
        try {
          inconnus = new Set(await this.pont.motsInconnus(lot));
        } catch {
          this.dictionnaireEnPanne = true;
          this.aDemander.clear();
          this.enDemande.clear();
          return;
        }
        const dico = new Map(this.dictionnaire);
        for (const w of lot) {
          dico.set(w, inconnus.has(w));
          this.enDemande.delete(w);
        }
        this.dictionnaire = dico;
      }
    } finally {
      this.orthographeEnCours = false;
    }
  }

  /**
   * « C'est voulu » : la remarque se tait pour ce mot, sur cet ordinateur. Pour l'orthographe,
   * seuls les mots signalés à ce moment se taisent : un mot inconnu ajouté plus tard le sera.
   */
  ignorer(id: string, code: CodeRemarque): void {
    let cles = [`${id}:${code}`];
    if (code === 'orthographe') {
      const m = this.brouillon?.id === id ? this.brouillon : etat.liste.mots.find((x) => x.id === id);
      cles = m === undefined ? [] : this.inconnusDe(m, false).map((w) => `${id}:orthographe:${w}`);
    }
    this.ignorees = new Set([...this.ignorees, ...cles]);
    ecrire(CLE_IGNOREES, [...this.ignorees]);
  }

  /**
   * L'historique lu dans l'histoire de la branche `donnees` de la copie (conception, section 15.5) ;
   * null sans copie, si la lecture échoue ou ne trouve aucune liste : l'écran montre alors l'historique de l'ordinateur.
   */
  async historiqueDuDepot(): Promise<EntreeHistorique[] | null> {
    try {
      const h: unknown = await this.pont.historique();
      const valide = Array.isArray(h) ? validerHistorique(h) : [];
      return valide.length > 0 ? valide : null;
    } catch {
      return null;
    }
  }

  /**
   * « Corriger » : la définition du brouillon prend la correction de la remarque, calculée sur le texte
   * du moment. Rien n'est enregistré. `ecrire`, s'il est donné, pose le texte à la place (la fiche le
   * fait passer par la zone de saisie, pour que Ctrl+Z l'annule).
   */
  corriger(code: CodeRemarque, ecrire?: (definition: string) => void): void {
    const correction = this.remarquesFiche.find((r) => r.code === code)?.correction ?? null;
    if (this.brouillon === null || correction === null) return;
    if (ecrire === undefined) this.brouillon.definition = correction;
    else ecrire(correction);
  }

  /** Les propositions en attente pour ce mot qui valent pour lui tel qu'il est. */
  propositionsDe(m: Mot): Proposition[] {
    return (this.enAttente.get(m.id) ?? []).filter((p) => appliquable(p, m));
  }

  private garderPropositions(suivies: PropositionSuivie[]): void {
    this.suivies = suivies;
    ecrire(CLE_PROPOSITIONS, suivies);
  }

  private trancher(cles: ReadonlySet<string>, sort: SortProposition): void {
    this.garderPropositions(this.suivies.map((p) => (cles.has(cleProposition(p)) ? { ...p, sort } : p)));
  }

  /**
   * Charge les propositions d'un fichier ; celles déjà connues gardent leur sort. Dit combien sont à
   * traiter ; faux, sans rien changer, si le fichier ne se lit pas.
   */
  chargerPropositions(texte: string): boolean {
    const lues = lirePropositions(texte);
    if (lues === null) {
      this.avis = alerte('Ce fichier ne contient pas de propositions lisibles.');
      return false;
    }
    const sorts = new Map(this.suivies.map((p) => [cleProposition(p), p.sort]));
    const vues = new Set<string>();
    const suivies: PropositionSuivie[] = [];
    for (const p of lues) {
      const cle = cleProposition(p);
      if (vues.has(cle)) continue;
      vues.add(cle);
      suivies.push({ ...p, sort: sorts.get(cle) ?? 'attente' });
    }
    // Les propositions déjà tranchées restent connues, même absentes du nouveau fichier : un refus ne revient pas.
    for (const p of this.suivies) if (p.sort !== 'attente' && !vues.has(cleProposition(p))) suivies.push(p);
    this.garderPropositions(suivies);
    const n = etat.liste.mots.reduce((total, m) => total + this.propositionsDe(m).length, 0);
    this.avis = calme(n === 0 ? 'Aucune proposition à traiter.' : `${n} proposition${n > 1 ? 's' : ''} à traiter.`);
    return true;
  }

  /**
   * « Corriger » une proposition : appliquée au brouillon seul ; rien n'est enregistré. Pour la
   * définition, `ecrire`, s'il est donné, pose le texte corrigé (voir `corriger`).
   */
  appliquerProposition(p: Proposition, ecrire?: (definition: string) => void): void {
    const b = this.brouillon;
    if (b === null || !appliquable(p, b)) return;
    const corrige = appliquer(p, { ...b, sources: [...b.sources] });
    if (p.champ === 'definition') {
      if (ecrire === undefined) b.definition = corrige.definition;
      else ecrire(corrige.definition);
    }
    else if (p.champ === 'genre') b.genre = corrige.genre;
    else b.sources = corrige.sources;
    this.appliqueesAuBrouillon.add(cleProposition(p));
  }

  /** « Non » : la proposition est refusée et ne revient plus. */
  refuserProposition(p: Proposition): void {
    this.trancher(new Set([cleProposition(p)]), 'refusee');
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
