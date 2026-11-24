/** Forme de comparaison : minuscules, sans accents, apostrophe courbe redressée. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/’/g, "'")
    .toLowerCase();
}
