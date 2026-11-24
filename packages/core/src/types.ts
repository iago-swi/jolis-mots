/** Un mot du vocabulaire. */
export interface Mot {
  id: string;
  mot: string;
  tri: string;
  genre: string;
  definition: string;
  sources: string[];
  note: string;
  util: string;
  aCompleter: boolean;
}

/** Le fichier de mots publié, lu par l'application. */
export interface FichierMots {
  format: 1;
  publie: string;
  mots: Mot[];
}

/** Un mot est complet s'il a une définition et n'est pas marqué « à compléter ». */
export function estComplet(m: Mot): boolean {
  return m.definition.trim() !== '' && !m.aCompleter;
}
