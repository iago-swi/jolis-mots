import { validerFichier } from './fichier';
import type { FichierMots } from './types';

/** Où l'on trouve la dernière version de la liste (conception, section 5.5). */
export const ADRESSE_LISTE = 'https://raw.githubusercontent.com/iago-swi/jolis-mots/donnees/mots.json';

/**
 * La liste reçue si elle a la bonne forme, une date lisible et soit plus récente que
 * l'actuelle, soit que l'actuelle n'a pas de date lisible ; sinon l'actuelle, telle quelle.
 */
export function choisirListe(actuelle: FichierMots, recue: unknown): FichierMots {
  const valide = validerFichier(recue);
  if (valide === null) return actuelle;
  const date = Date.parse(valide.publie);
  if (Number.isNaN(date)) return actuelle;
  const dateActuelle = Date.parse(actuelle.publie);
  return Number.isNaN(dateActuelle) || date > dateActuelle ? valide : actuelle;
}
