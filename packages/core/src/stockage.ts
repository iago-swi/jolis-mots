/**
 * Lit un texte JSON gardé sur l'appareil. Rend `defaut` si le texte est absent,
 * illisible, ou d'une autre sorte que `defaut` (objet, tableau, nombre…).
 */
export function lireJson<T>(texte: string | null, defaut: T): T {
  if (texte === null) return defaut;
  let valeur: unknown;
  try {
    valeur = JSON.parse(texte);
  } catch {
    return defaut;
  }
  if (valeur === null || typeof valeur !== typeof defaut || Array.isArray(valeur) !== Array.isArray(defaut)) {
    return defaut;
  }
  return valeur as T;
}
