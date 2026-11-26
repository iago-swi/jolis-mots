import {
  choisirListe,
  estComplet,
  marquerMontre,
  noterListe,
  normaliser,
  prochainMot,
  QUESTIONS_PAR_DEFAUT,
  QUESTIONS_POSSIBLES,
  repondre,
  validerHistorique,
  validerProgres,
  validerReference,
  type EntreeHistorique,
  type FichierMots,
  type Mot,
  type Portee,
  type Progres,
} from '@jolis-mots/core';
import type { Annonce } from './bilan';
import { listeEmbarquee } from './liste-embarquee';
import { pont } from './pont';
import { CLES, ecrire, lire } from './stockage';

export type Ecran = 'mot' | 'quiz' | 'recueil' | 'reglages' | 'historique' | 'atelier';
export type Palette = 'systeme' | 'papier' | 'nuit' | 'ivoire' | 'ceruleen';
export interface Reglages {
  questionsParQuiz: number;
  palette: Palette;
}

/** L'Atelier n'existe que sur bureau ; ailleurs, « #atelier » mène à l'écran Mot. */
const ECRANS: readonly Ecran[] = ['mot', 'quiz', 'recueil', 'reglages', 'historique', ...(pont === null ? [] : ['atelier' as const])];
const PALETTES: readonly Palette[] = ['systeme', 'papier', 'nuit', 'ivoire', 'ceruleen'];
const PORTEES: readonly Portee[] = ['tous', 'vus'];
const REGLAGES_PAR_DEFAUT: Reglages = { questionsParQuiz: QUESTIONS_PAR_DEFAUT, palette: 'systeme' };

function estPalette(x: unknown): x is Palette {
  return PALETTES.includes(x as Palette);
}

function estPortee(x: unknown): x is Portee {
  return PORTEES.includes(x as Portee);
}

function bornerQuestions(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return REGLAGES_PAR_DEFAUT.questionsParQuiz;
  // La plus petite taille possible supérieure ou égale ; au-delà de la plus grande, la plus grande.
  return QUESTIONS_POSSIBLES.find((t) => t >= n) ?? QUESTIONS_POSSIBLES[QUESTIONS_POSSIBLES.length - 1]!;
}

/** La liste gardée sur l'appareil si elle est valide et plus récente que l'embarquée, sinon l'embarquée. */
function listeDeDepart(): FichierMots {
  return choisirListe(listeEmbarquee, lire<unknown>(CLES.liste, null));
}

/** Réglages gardés ; ceux de la 0.1.0 (`motsParSeance`) n'ont pas de nombre de questions : 10 par défaut. */
function reglagesDeDepart(): Reglages {
  const r = lire<Partial<Reglages>>(CLES.reglages, {});
  return {
    questionsParQuiz: bornerQuestions(r.questionsParQuiz),
    palette: estPalette(r.palette) ? r.palette : REGLAGES_PAR_DEFAUT.palette,
  };
}

/** Écran demandé par l'adresse (« #quiz »…), Mot par défaut. */
export function ecranDeLAdresse(hash: string): Ecran {
  const nom = hash.replace(/^#/, '');
  return ECRANS.includes(nom as Ecran) ? (nom as Ecran) : 'mot';
}

class Etat {
  liste = $state<FichierMots>(listeDeDepart());
  progres = $state<Progres>(validerProgres(lire<unknown>(CLES.progres, {})));
  favoris = $state<string[]>(lire<unknown[]>(CLES.favoris, []).filter((x): x is string => typeof x === 'string'));
  reglages = $state<Reglages>(reglagesDeDepart());
  /** L'historique de la liste, du plus ancien au plus récent (conception, section 14). */
  historique = $state.raw<EntreeHistorique[]>(validerHistorique(lire<unknown>(CLES.historique, [])));
  /**
   * Sur le téléphone, ce que la bulle dit dix secondes : l'entrée que l'historique vient de gagner,
   * ou le résultat d'une vérification (conception, section 19) ; null quand il n'y a rien à dire.
   */
  annonce = $state.raw<Annonce | null>(null);
  /** L'entrée que l'écran Historique déplie en s'ouvrant (posée en touchant l'annonce). */
  entreeADeplier: string | null = null;
  /** La dernière liste notée dans l'historique, réduite à ce qui sert à comparer. */
  private reference = validerReference(lire<unknown>(CLES.reference, null));
  /** Les mots montrés sur l'écran Mot depuis l'ouverture, dans l'ordre. Mémoire seulement. */
  lus = $state<string[]>([]);
  /** Rang, dans `lus`, du mot affiché. */
  position = $state(0);
  /** Quiz demandé par l'adresse (« ?quiz=tous », « ?quiz=vus ») : l'écran Quiz saute le choix. */
  quizDemande = $state<Portee | null>(null);
  ecran = $state<Ecran>('mot');
  /** L'écran à retrouver en quittant les réglages. */
  ecranAvantReglages: Ecran = 'mot';
  ficheOuverte = $state<string | null>(null);
  /** Volet « Autres auteurs » du recueil, ici pour que le bouton retour d'Android puisse le fermer. */
  panneauAuteurs = $state(false);
  /** Vrai après `demarrer` : avant, aucun mot n'est montré, c'est `demarrer` qui tire le premier. */
  private demarre = false;
  /** Palette imposée par l'adresse (« ?palette=nuit »), jamais enregistrée. */
  paletteForcee = $state<Palette | null>(null);

  readonly complets: Mot[] = $derived(this.liste.mots.filter(estComplet));
  readonly motCourant: Mot | null = $derived.by(() => {
    const id = this.lus[this.position];
    return this.complets.find((m) => m.id === id) ?? null;
  });
  readonly paletteAffichee: Palette = $derived(this.paletteForcee ?? this.reglages.palette);
  /** L'appareil est en mode sombre ; suivi tant que l'application est ouverte (voir `demarrer`). */
  modeSombreAppareil = $state(false);
  /** Le fond affiché est sombre : Nuit, ou « Comme le système » quand l'appareil est en mode sombre (comme dans app.css). */
  readonly fondSombre: boolean = $derived(
    this.paletteAffichee === 'nuit' || (this.paletteAffichee === 'systeme' && this.modeSombreAppareil),
  );

  /**
   * Appelle `rappel` tout de suite, puis chaque fois que le fond sous les barres du système passe
   * du clair au sombre ou l'inverse. Bord à bord, ce fond est celui de la palette affichée ; sinon
   * c'est celui de la fenêtre Android, qui suit le mode de l'appareil (voir `webViewBordABord`).
   */
  suivreFondDesBarres(bordABord: boolean, rappel: (sombre: boolean) => void): void {
    $effect.root(() => {
      $effect(() => rappel(bordABord ? this.fondSombre : this.modeSombreAppareil));
    });
  }

  /** Ajoute `m` aux mots lus et note qu'il vient d'être vu. */
  private montrer(m: Mot): void {
    this.lus = [...this.lus, m.id];
    this.position = this.lus.length - 1;
    this.progres = marquerMontre(this.progres, m.id, new Date());
    ecrire(CLES.progres, this.progres);
  }

  /**
   * Le prochain mot à montrer : un mot pas encore lu depuis l'ouverture ; quand tous l'ont été,
   * celui vu il y a le plus longtemps, sauf le dernier montré. La lecture n'a pas de fin.
   */
  private tirer(): Mot | null {
    return (
      prochainMot(this.complets, this.progres, this.lus, Math.random) ??
      prochainMot(this.complets, this.progres, this.lus.slice(-1), Math.random)
    );
  }

  /** Avance parmi les mots lus ; au bout, tire un nouveau mot. */
  suivant(): void {
    if (this.position < this.lus.length - 1) {
      this.position += 1;
      return;
    }
    const m = this.tirer();
    if (m !== null) this.montrer(m);
  }

  /**
   * Adopte tout de suite `recue` si elle est valide et plus récente que la liste en place, et la garde
   * sur l'appareil (conception, section 19). Rend vrai si elle a été adoptée.
   */
  recevoirListe(recue: unknown): boolean {
    const choisie = choisirListe(this.liste, recue);
    if (choisie === this.liste) return false;
    ecrire(CLES.liste, choisie);
    this.remplacerListe(choisie);
    return true;
  }

  /**
   * Adopte `l` tout de suite et remet l'état d'aplomb : les mots qui ne sont plus complets quittent `lus`,
   * le mot affiché reste s'il le peut, un mot est tiré s'il n'en reste aucun de lu (après `demarrer` seulement), la fiche ouverte se
   * ferme si son mot n'est plus complet.
   */
  remplacerListe(l: FichierMots): void {
    const affiche = this.lus[this.position];
    this.liste = l;
    const complets = new Set(this.complets.map((m) => m.id));
    this.lus = this.lus.filter((id) => complets.has(id));
    const rang = affiche === undefined ? -1 : this.lus.indexOf(affiche);
    this.position = rang >= 0 ? rang : Math.max(0, Math.min(this.position, this.lus.length - 1));
    if (this.demarre && this.lus.length === 0) {
      const m = this.tirer();
      if (m !== null) this.montrer(m);
    }
    if (this.ficheOuverte !== null && !complets.has(this.ficheOuverte)) this.ficheOuverte = null;
    // Sur bureau, la liste en place porte des modifications pas encore envoyées : l'atelier note
    // lui-même chaque liste envoyée ou reçue (voir `Atelier.poser`).
    if (pont === null) this.noterListe(l);
  }

  /** Note `f` dans l'historique si elle est nouvelle pour l'appareil (conception, section 14). */
  noterListe(f: FichierMots): void {
    if (Number.isNaN(Date.parse(f.publie))) return;
    const r = noterListe(this.historique, this.reference, f);
    if (r.reference !== this.reference) {
      this.reference = r.reference;
      ecrire(CLES.reference, r.reference);
    }
    if (r.historique !== this.historique) {
      this.historique = r.historique;
      ecrire(CLES.historique, r.historique);
      // Sur bureau, l'atelier sait ce qu'il vient d'envoyer : pas d'annonce.
      const nouvelle = r.historique[r.historique.length - 1];
      if (pont === null && nouvelle !== undefined && !nouvelle.debut) this.annonce = { sorte: 'nouvelle', entree: nouvelle };
    }
  }

  /**
   * Pose le résultat d'une vérification. Au lancement, « à jour » ne remplace pas une annonce de nouvelle
   * liste encore affichée : une liste gardée par une version précédente a pu être adoptée juste avant.
   */
  annoncer(a: Annonce, auLancement = false): void {
    if (auLancement && a.sorte === 'a-jour' && this.annonce?.sorte === 'nouvelle') return;
    this.annonce = a;
  }

  fermerAnnonce(): void {
    this.annonce = null;
  }

  /**
   * L'annonce touchée : pour une nouvelle liste, l'historique s'ouvre, son entrée dépliée, et le retour
   * ramène à l'écran d'avant. Sinon, ou si l'historique est déjà ouvert, elle se ferme seulement.
   */
  ouvrirAnnonce(): void {
    const a = this.annonce;
    this.annonce = null;
    if (a?.sorte !== 'nouvelle' || this.ecran === 'historique') return;
    this.entreeADeplier = a.entree.publie;
    if (this.ecran !== 'reglages') this.ecranAvantReglages = this.ecran;
    this.allerA('historique');
  }

  precedent(): void {
    if (this.position > 0) this.position -= 1;
  }

  basculerFavori(id: string): void {
    this.favoris = this.favoris.includes(id) ? this.favoris.filter((f) => f !== id) : [...this.favoris, id];
    ecrire(CLES.favoris, this.favoris);
  }

  repondre(id: string, juste: boolean): void {
    this.progres = repondre(this.progres, id, juste, new Date());
    ecrire(CLES.progres, this.progres);
  }

  /**
   * Posé par l'atelier : appelé avant de quitter son écran. Rend vrai s'il retient la sortie
   * (une fiche modifiée : il pose la question, puis appelle `suite` si on quitte quand même).
   */
  retenirSortie: ((suite: () => void) => boolean) | null = null;

  allerA(e: Ecran): void {
    if (this.ecran === 'atelier' && e !== 'atelier' && this.retenirSortie?.(() => this.allerA(e))) {
      // L'adresse a pu changer (retour du navigateur) : elle revient à l'atelier.
      if (typeof location !== 'undefined' && ecranDeLAdresse(location.hash) !== 'atelier') location.hash = 'atelier';
      return;
    }
    if (e === 'reglages' && this.ecran !== 'reglages' && this.ecran !== 'historique') this.ecranAvantReglages = this.ecran;
    this.ecran = e;
    if (typeof location !== 'undefined' && ecranDeLAdresse(location.hash) !== e) location.hash = e;
  }

  /**
   * Bouton retour d'Android : ferme la fiche, le volet ou les réglages ; sinon revient à l'écran Mot.
   * Rend faux quand il n'y a plus rien à fermer : on est sur l'écran Mot, l'application peut se quitter.
   */
  retour(): boolean {
    if (this.ficheOuverte !== null) this.ficheOuverte = null;
    else if (this.panneauAuteurs) this.panneauAuteurs = false;
    else if (this.ecran === 'historique') this.allerA('reglages');
    else if (this.ecran === 'reglages') this.allerA(this.ecranAvantReglages);
    else if (this.ecran !== 'mot') this.allerA('mot');
    else return false;
    return true;
  }

  reglerPalette(p: Palette): void {
    this.paletteForcee = null;
    this.reglages = { ...this.reglages, palette: p };
    ecrire(CLES.reglages, this.reglages);
  }

  reglerQuestions(n: number): void {
    this.reglages = { ...this.reglages, questionsParQuiz: bornerQuestions(n) };
    ecrire(CLES.reglages, this.reglages);
  }

  /** Retour à l'écran Mot, sur le mot affiché ; s'il n'y en a pas, un mot est tiré. */
  reprendreLecture(): void {
    this.allerA('mot');
    if (this.motCourant === null) this.suivant();
  }

  /** Efface progrès et favoris, puis repart sur un mot neuf, sans historique de lecture. */
  effacerProgres(): void {
    this.progres = {};
    this.favoris = [];
    ecrire(CLES.progres, this.progres);
    ecrire(CLES.favoris, this.favoris);
    this.lus = [];
    this.position = 0;
    this.reprendreLecture();
  }

  /** Mot complet dont le mot entier (« sans ambages »), sinon le tri (« ambage »), vaut `cle` normalisée. */
  private trouver(cle: string): Mot | undefined {
    return (
      this.complets.find((m) => normaliser(m.mot) === cle) ?? this.complets.find((m) => normaliser(m.tri) === cle)
    );
  }

  /**
   * Premier affichage. L'adresse peut imposer l'écran (« #quiz »), la palette (« ?palette=nuit »),
   * le quiz (« ?quiz=vus ») et le premier mot (« ?mot=ceruleen », comparé au tri normalisé).
   */
  demarrer(adresse: { search: string; hash: string }): void {
    this.demarre = true;
    const params = new URLSearchParams(adresse.search);
    const palette = params.get('palette');
    if (estPalette(palette)) this.paletteForcee = palette;
    const quiz = params.get('quiz');
    this.quizDemande = estPortee(quiz) ? quiz : null;
    this.ecran = ecranDeLAdresse(adresse.hash);

    if (typeof matchMedia === 'function') {
      const sombre = matchMedia('(prefers-color-scheme: dark)');
      this.modeSombreAppareil = sombre.matches;
      sombre.addEventListener('change', (e) => {
        this.modeSombreAppareil = e.matches;
      });
    }

    if (pont === null) this.noterListe(this.liste);
    const voulu = params.get('mot');
    const impose = voulu === null ? undefined : this.trouver(normaliser(voulu));
    if (impose !== undefined) this.montrer(impose);
    else this.suivant();
  }
}

export const etat = new Etat();
