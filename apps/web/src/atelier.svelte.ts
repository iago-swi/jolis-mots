import {
  compterModifications,
  creerIdUnique,
  dater,
  ecrireFichier,
  messageDEnvoi,
  nettoyerFiche,
  poserFiche,
  retirerFiche,
  validerFichier,
  validerPourEnvoi,
  type EtatDepot,
  type FichierMots,
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
}

const alerte = (texte: string): Avis => ({ ton: 'alerte', texte });
const calme = (texte: string): Avis => ({ ton: 'calme', texte });

const ENVOYEE = calme('Liste envoyée. Le téléphone la verra dans quelques minutes.');
const SANS_GIT = alerte("Git est introuvable sur cette machine. L'atelier en a besoin pour recevoir et envoyer la liste.");
const DIVERGENCE = alerte("La liste en ligne a changé ailleurs. Rien n'a été envoyé.");
const CONNEXION = alerte("L'atelier a besoin d'une connexion une première fois, pour recevoir la liste.");
const ILLISIBLE = alerte(
  "Le fichier des mots de l'atelier est illisible. Tu peux reprendre la liste en ligne ; ta version sera mise de côté.",
);
const NON_ENREGISTREE = alerte("La fiche n'a pas pu être enregistrée.");
const ENVOI_ECHOUE = alerte("L'envoi a échoué. Tes modifications restent en attente.");

const ECHECS_D_ENVOI: Record<Exclude<RaisonDepot, 'pret'>, Avis> = {
  'sans-reseau': alerte("Pas de réseau : la liste n'est pas partie. Tes modifications restent en attente."),
  refus: alerte("GitHub a refusé l'envoi. Tes modifications restent en attente."),
  divergence: DIVERGENCE,
  erreur: ENVOI_ECHOUE,
  'sans-git': SANS_GIT,
};

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

/**
 * L'atelier, sur bureau : la copie locale des mots (lue et écrite par le pont), le compteur
 * de modifications et les avis. La liste de travail est `etat.liste`, que lisent aussi les écrans
 * de lecture. Les opérations passent une à une, dans l'ordre où elles sont demandées.
 */
export class Atelier {
  depot = $state<EtatDepot | null>(null);
  occupe = $state(false);
  avis = $state<Avis | null>(null);
  /** La liste locale lue dans `depot.locale`, null si elle manque ou ne se lit pas. */
  private locale = $state.raw<FichierMots | null>(null);
  /** La dernière liste envoyée ou reçue, lue dans `depot.envoyee`. */
  private envoyee = $state.raw<FichierMots | null>(null);

  /** Une copie locale existe et se lit. */
  readonly disponible: boolean = $derived(this.locale !== null);
  /** Une copie existe mais son fichier des mots manque ou ne se lit pas : rien ne doit l'écraser. */
  private readonly illisible: boolean = $derived(
    !this.disponible && this.depot !== null && (this.depot.locale !== null || this.depot.envoyee !== null),
  );
  /** Entre la liste envoyée et `etat.liste`. */
  readonly modifications: Modifications = $derived(
    this.disponible ? compterModifications(this.envoyee?.mots ?? [], etat.liste.mots) : AUCUNE,
  );

  private file: Promise<unknown> = Promise.resolve();
  private enCours = 0;

  constructor(private readonly pont: PontBureau) {}

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
    if (avant === null || r.envoyee !== avant.envoyee) this.envoyee = lireListe(r.envoyee);
    if (avant === null || r.locale !== avant.locale) {
      this.locale = lireListe(r.locale);
      if (this.locale !== null) etat.remplacerListe(this.locale);
    }
  }

  /** L'avis après avoir reçu ou repris la liste ; null quand il n'y a rien à dire. */
  private avisDeLaCopie(raison: RaisonDepot): Avis | null {
    if (raison === 'sans-git') return SANS_GIT;
    if (this.illisible) return ILLISIBLE;
    if (!this.disponible) return raison === 'pret' ? null : CONNEXION;
    // Avec une copie, une panne de réseau ne se dit pas : l'atelier travaille hors ligne.
    return raison === 'divergence' ? DIVERGENCE : null;
  }

  /** Ouvre la copie locale et pose sa liste ; puis va voir la liste en ligne, sans attendre. */
  async demarrer(): Promise<void> {
    await this.enFile(async () => {
      this.poser(await this.appeler(() => this.pont.ouvrir()));
      // Pas d'alarme pendant la première synchronisation : elle va peut-être télécharger la copie.
      this.avis = this.illisible ? ILLISIBLE : null;
    });
    void this.reessayer();
  }

  /** Synchronise : télécharge la copie si elle manque, sinon va voir la liste en ligne. */
  reessayer(): Promise<void> {
    return this.enFile(async () => {
      const r = await this.appeler(() => this.pont.synchroniser());
      this.poser(r);
      this.avis = this.avisDeLaCopie(r.raison);
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
    const fiche = ranger(nettoyerFiche(f));
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
      if (this.illisible) this.avis = ILLISIBLE;
      else this.avis = r.raison === 'pret' ? ENVOYEE : ECHECS_D_ENVOI[r.raison];
    });
  }

  /** Met la version locale de côté et reprend la liste en ligne. */
  reprendre(): Promise<void> {
    return this.enFile(async () => {
      const r = await this.appeler(() => this.pont.reprendre());
      this.poser(r);
      if (r.raison === 'pret' && this.disponible) {
        this.avis = calme(
          r.sauvegarde === null
            ? 'La liste en ligne est reprise.'
            : `La liste en ligne est reprise. Ta version est gardée ici : ${r.sauvegarde}`,
        );
      } else {
        // Sans phrase pour cette panne, l'avis qui a mené à la reprise reste.
        this.avis = this.avisDeLaCopie(r.raison) ?? this.avis;
      }
    });
  }

  /** Un identifiant que ne porte aucun mot, ni ici ni dans la liste envoyée. */
  idNeuf(): string {
    return creerIdUnique([...etat.liste.mots, ...(this.envoyee?.mots ?? [])].map((m) => m.id));
  }
}

/** L'atelier, sur bureau seulement. */
export const atelier: Atelier | null = pont === null ? null : new Atelier(pont);
