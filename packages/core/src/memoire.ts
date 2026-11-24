/** État d'un mot dans la mémoire de l'utilisateur (dates ISO). */
export interface EtatMot {
  vu: string;
  case: 1 | 2 | 3 | 4 | 5;
  du: string;
  acquis: boolean;
}

/** Progrès par identifiant de mot. */
export type Progres = Record<string, EtatMot>;
