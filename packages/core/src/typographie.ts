/** Apostrophe typographique et points de suspension ; la ponctuation haute reste telle que saisie. */
export function embellir(texte: string): string {
  return texte.replace(/'/g, '’').replace(/\.\.\./g, '…');
}

/** Guillemets français avec espaces fines insécables, sauf si le texte en porte déjà. */
export function entreGuillemets(texte: string): string {
  if (texte.startsWith('«')) return texte;
  return `«\u202F${texte}\u202F»`;
}

/** Taille ordinaire du mot, en px. */
export const TAILLE_DU_MOT = 54;

/** Seconde taille, en px, pour un mot d'un seul tenant trop long pour une ligne. */
export const TAILLE_DU_MOT_LONG = 40;

/**
 * Longueur du plus long morceau qui tient encore sur une ligne à la taille ordinaire,
 * dans la colonne de 334 px d'un téléphone de 390 px (mesuré sur la liste réelle).
 */
export const LETTRES_SUR_UNE_LIGNE = 12;

/**
 * Taille de police du mot : la taille ordinaire, sauf si l'un de ses morceaux (suite sans
 * espace ni trait d'union, où le navigateur ne peut pas passer à la ligne) est trop long.
 */
export function tailleDuMot(mot: string): number {
  const plusLong = Math.max(0, ...mot.split(/[\s-]+/).map((morceau) => [...morceau].length));
  return plusLong <= LETTRES_SUR_UNE_LIGNE ? TAILLE_DU_MOT : TAILLE_DU_MOT_LONG;
}
