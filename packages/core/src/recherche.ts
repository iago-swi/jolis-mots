import { auteursDe } from './sources';
import type { Mot } from './types';

/** Forme de comparaison : minuscules, sans accents, ligatures dépliées, apostrophe courbe redressée. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/’/g, "'")
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
}

function comparer(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Ordre alphabétique : selon le tri normalisé, puis selon le mot. Ne modifie pas l'entrée. */
export function ordonner(mots: Mot[]): Mot[] {
  return [...mots].sort(
    (a, b) => comparer(normaliser(a.tri), normaliser(b.tri)) || comparer(normaliser(a.mot), normaliser(b.mot)),
  );
}

/** Première lettre du tri normalisé, en majuscule ; « # » si ce n'est pas une lettre. */
export function lettrine(m: Mot): string {
  const premiere = normaliser(m.tri).charAt(0);
  return /^[a-z]$/.test(premiere) ? premiere.toUpperCase() : '#';
}

export interface Filtre {
  requete: string;
  auteur: string | null;
  favoris: string[] | null;
}

/** Garde les mots qui répondent au filtre, dans l'ordre reçu. */
export function filtrer(mots: Mot[], f: Filtre): Mot[] {
  const requete = normaliser(f.requete.trim());
  const favoris = f.favoris === null ? null : new Set(f.favoris);
  return mots.filter((m) => {
    if (requete !== '' && !normaliser(m.mot).includes(requete) && !normaliser(m.tri).includes(requete)) return false;
    if (f.auteur !== null && !m.sources.some((s) => auteursDe(s).includes(f.auteur as string))) return false;
    if (favoris !== null && !favoris.has(m.id)) return false;
    return true;
  });
}
