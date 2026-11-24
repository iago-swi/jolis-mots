/** Apostrophe typographique et points de suspension ; la ponctuation haute reste telle que saisie. */
export function embellir(texte: string): string {
  return texte.replace(/'/g, '’').replace(/\.\.\./g, '…');
}

/** Guillemets français avec espaces fines insécables, sauf si le texte en porte déjà. */
export function entreGuillemets(texte: string): string {
  if (texte.startsWith('«')) return texte;
  return `«\u202F${texte}\u202F»`;
}

/** Taille de police en px pour 334 px de large : 62 jusqu'à 9 caractères, jamais sous 34. */
export function tailleDuMot(mot: string): number {
  const longueur = [...mot].length;
  if (longueur <= 9) return 62;
  return Math.max(34, Math.round((62 * 9) / longueur));
}
