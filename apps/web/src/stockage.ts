import { lireJson } from '@jolis-mots/core';

/** Clés de ce que l'appareil garde pour lui (conception, section 6.5). */
export const CLES = {
  progres: 'jolismots.progres.v1',
  favoris: 'jolismots.favoris.v1',
  reglages: 'jolismots.reglages.v1',
  liste: 'jolismots.liste.v1',
};

/** Valeur gardée sous `cle`, ou `defaut` si elle manque, est illisible ou si le stockage est refusé. */
export function lire<T>(cle: string, defaut: T): T {
  try {
    return lireJson(localStorage.getItem(cle), defaut);
  } catch {
    return defaut;
  }
}

/** Garde `valeur` sous `cle` ; un stockage plein ou refusé est ignoré. */
export function ecrire(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Rien à faire : l'application continue avec ce qu'elle a en mémoire.
  }
}
