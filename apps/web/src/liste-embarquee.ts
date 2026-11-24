import { validerFichier, type FichierMots } from '@jolis-mots/core';
import brut from '../../../donnees/mots.json';

/** La liste telle qu'elle était à la fabrication de l'application ; vide si le fichier n'a pas la bonne forme. */
export const listeEmbarquee: FichierMots = validerFichier(brut) ?? { format: 1, publie: '', mots: [] };
