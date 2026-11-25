// Le contrat entre l'application web et Electron (types seulement).

import type { EntreeHistorique } from './historique';

/** Ce qu'a donné la dernière opération sur la copie locale des mots. */
export type RaisonDepot = 'pret' | 'sans-git' | 'sans-reseau' | 'refus' | 'divergence' | 'erreur';

/** L'état de la copie locale de la branche `donnees`, après une opération. */
export interface EtatDepot {
  /** 'pret' : la dernière opération a réussi. */
  raison: RaisonDepot;
  /** Dernier message de git, '' si tout va bien. */
  detail: string;
  /** Texte de mots.json dans la copie de travail ; null tant qu'il n'y a pas de copie. */
  locale: string | null;
  /** Texte de mots.json dans la dernière liste envoyée ou reçue (origin/donnees). */
  envoyee: string | null;
  /** Chemin du fichier mis de côté par `reprendre`, sinon null. */
  sauvegarde: string | null;
}

/** Ce qu'Electron met à la disposition de l'application web, dans l'atelier. */
export interface PontBureau {
  /** Sans réseau : ce qui est sur le disque. */
  ouvrir(): Promise<EtatDepot>;
  /** Télécharge la copie si elle manque, sinon va voir la liste en ligne. */
  synchroniser(): Promise<EtatDepot>;
  enregistrer(texte: string): Promise<EtatDepot>;
  envoyer(texte: string, message: string): Promise<EtatDepot>;
  reprendre(): Promise<EtatDepot>;
  ouvrirCnrtl(adresse: string): Promise<void>;
  signalerFicheModifiee(modifiee: boolean): void;
  /**
   * Les mots de `mots` inconnus du dictionnaire français, celui du correcteur de la fenêtre.
   * Sans dictionnaire, aucun.
   */
  motsInconnus(mots: string[]): Promise<string[]>;
  /**
   * L'historique de la liste tiré de l'histoire de la branche `donnees` dans la copie locale,
   * sans réseau ; null sans copie ou si la lecture échoue.
   */
  historique(): Promise<EntreeHistorique[] | null>;
}
