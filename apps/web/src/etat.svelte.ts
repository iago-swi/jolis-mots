import {
  choisirListe,
  estComplet,
  marquerVu,
  normaliser,
  prochainMot,
  repondre,
  type FichierMots,
  type Mot,
  type Progres,
} from '@jolis-mots/core';
import { listeEmbarquee } from './liste-embarquee';
import { CLES, ecrire, lire } from './stockage';

export type Ecran = 'mot' | 'quiz' | 'recueil' | 'reglages';
export type Palette = 'systeme' | 'papier' | 'nuit' | 'ivoire' | 'ceruleen';
export interface Reglages {
  motsParSeance: number;
  palette: Palette;
}

const ECRANS: readonly Ecran[] = ['mot', 'quiz', 'recueil', 'reglages'];
const PALETTES: readonly Palette[] = ['systeme', 'papier', 'nuit', 'ivoire', 'ceruleen'];
const REGLAGES_PAR_DEFAUT: Reglages = { motsParSeance: 3, palette: 'systeme' };

function estPalette(x: unknown): x is Palette {
  return PALETTES.includes(x as Palette);
}

function bornerSeance(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) ? Math.min(5, Math.max(2, n)) : REGLAGES_PAR_DEFAUT.motsParSeance;
}

/** La liste gardée sur l'appareil si elle est valide et plus récente que l'embarquée, sinon l'embarquée. */
function listeDeDepart(): FichierMots {
  return choisirListe(listeEmbarquee, lire<unknown>(CLES.liste, null));
}

function reglagesDeDepart(): Reglages {
  const r = lire<Partial<Reglages>>(CLES.reglages, {});
  return {
    motsParSeance: bornerSeance(r.motsParSeance),
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
  progres = $state<Progres>(lire<Progres>(CLES.progres, {}));
  favoris = $state<string[]>(lire<unknown[]>(CLES.favoris, []).filter((x): x is string => typeof x === 'string'));
  reglages = $state<Reglages>(reglagesDeDepart());
  /** La séance vit en mémoire seulement : elle repart à zéro à chaque lancement. */
  seance = $state<string[]>([]);
  /** Mots déjà interrogés depuis le début de la séance : le quiz ne les repose pas. Mémoire seulement. */
  repondus = $state<string[]>([]);
  position = $state(0);
  ecran = $state<Ecran>('mot');
  /** L'écran à retrouver en quittant les réglages. */
  ecranAvantReglages: Ecran = 'mot';
  ficheOuverte = $state<string | null>(null);
  /** Volet « Autres auteurs » du recueil, ici pour que le bouton retour d'Android puisse le fermer. */
  panneauAuteurs = $state(false);
  /** Liste téléchargée, gardée de côté jusqu'au prochain mot tiré. */
  private listeEnAttente: FichierMots | null = null;
  /** Palette imposée par l'adresse (« ?palette=nuit »), jamais enregistrée. */
  paletteForcee = $state<Palette | null>(null);

  readonly complets: Mot[] = $derived(this.liste.mots.filter(estComplet));
  readonly motCourant: Mot | null = $derived.by(() => {
    const id = this.seance[this.position];
    return this.complets.find((m) => m.id === id) ?? null;
  });
  readonly seanceFinie: boolean = $derived(
    this.seance.length >= this.reglages.motsParSeance && this.position === this.seance.length - 1,
  );
  readonly paletteAffichee: Palette = $derived(this.paletteForcee ?? this.reglages.palette);

  /** Ajoute `m` à la séance et le marque vu. */
  private montrer(m: Mot): void {
    this.seance = [...this.seance, m.id];
    this.position = this.seance.length - 1;
    this.progres = marquerVu(this.progres, m.id, new Date());
    ecrire(CLES.progres, this.progres);
  }

  /** Avance dans la séance ; au bout, tire un nouveau mot. */
  suivant(): void {
    if (this.position < this.seance.length - 1) {
      this.position += 1;
      return;
    }
    this.adopterListeEnAttente();
    const m = prochainMot(this.complets, this.progres, this.seance, Math.random);
    if (m !== null) this.montrer(m);
  }

  /** Retient `recue` si elle est valide et plus récente que la liste en place : gardée sur l'appareil, adoptée au prochain mot tiré. */
  proposerListe(recue: unknown): void {
    const enPlace = this.listeEnAttente ?? this.liste;
    const choisie = choisirListe(enPlace, recue);
    if (choisie === enPlace) return;
    this.listeEnAttente = choisie;
    ecrire(CLES.liste, choisie);
  }

  private adopterListeEnAttente(): void {
    if (this.listeEnAttente === null) return;
    this.liste = this.listeEnAttente;
    this.listeEnAttente = null;
  }

  precedent(): void {
    if (this.position > 0) this.position -= 1;
  }

  basculerFavori(id: string): void {
    this.favoris = this.favoris.includes(id) ? this.favoris.filter((f) => f !== id) : [...this.favoris, id];
    ecrire(CLES.favoris, this.favoris);
  }

  repondre(id: string, juste: boolean): void {
    if (!this.repondus.includes(id)) this.repondus = [...this.repondus, id];
    this.progres = repondre(this.progres, id, juste, new Date());
    ecrire(CLES.progres, this.progres);
  }

  allerA(e: Ecran): void {
    if (e === 'reglages' && this.ecran !== 'reglages') this.ecranAvantReglages = this.ecran;
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

  reglerSeance(n: number): void {
    this.reglages = { ...this.reglages, motsParSeance: bornerSeance(n) };
    ecrire(CLES.reglages, this.reglages);
  }

  nouvelleSeance(): void {
    this.seance = [];
    this.repondus = [];
    this.position = 0;
    this.allerA('mot');
    this.suivant();
  }

  effacerProgres(): void {
    this.progres = {};
    this.favoris = [];
    ecrire(CLES.progres, this.progres);
    ecrire(CLES.favoris, this.favoris);
    this.nouvelleSeance();
  }

  /** Mot complet dont le mot entier (« sans ambages »), sinon le tri (« ambage »), vaut `cle` normalisée. */
  private trouver(cle: string): Mot | undefined {
    return (
      this.complets.find((m) => normaliser(m.mot) === cle) ?? this.complets.find((m) => normaliser(m.tri) === cle)
    );
  }

  /**
   * Premier affichage. L'adresse peut imposer l'écran (« #quiz »), la palette
   * (« ?palette=nuit ») et le premier mot (« ?mot=ceruleen », comparé au tri normalisé).
   */
  demarrer(adresse: { search: string; hash: string }): void {
    const params = new URLSearchParams(adresse.search);
    const palette = params.get('palette');
    if (estPalette(palette)) this.paletteForcee = palette;
    this.ecran = ecranDeLAdresse(adresse.hash);

    const voulu = params.get('mot');
    const impose = voulu === null ? undefined : this.trouver(normaliser(voulu));
    if (impose !== undefined) this.montrer(impose);
    else this.suivant();
  }
}

export const etat = new Etat();
