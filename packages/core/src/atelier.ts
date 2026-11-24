import { comparerMots } from './fichier';
import { normaliser } from './recherche';
import { estComplet } from './types';
import type { Mot } from './types';

export type FiltreAtelier = 'tous' | 'complets' | 'aCompleter' | 'doublons';

const PREFIXES = ['se ', "s'", 's’', 'le ', 'la ', 'les ', "l'", 'l’', 'un ', 'une ', 'des '];

/** Retire les espaces aux bords, insécables (U+00A0, U+202F) comprises. */
function rogner(texte: string): string {
  return texte.replace(/^\s+|\s+$/g, '');
}

/** Propose un Tri : avant la première virgule, sans parenthèse finale, en minuscules, sans article ni « se ». */
export function proposerTri(mot: string): string {
  const base = rogner(
    mot
      .split(',')[0]!
      .replace(/\([^()]*\)\s*$/, '')
      .toLowerCase(),
  );
  const prefixe = PREFIXES.find((p) => base.startsWith(p));
  return prefixe === undefined ? base : rogner(base.slice(prefixe.length));
}

/** Forme de comparaison des doublons : minuscules, espaces réduits, bords retirés ; les accents comptent. */
function cleDoublon(texte: string): string {
  return rogner(texte.toLowerCase().replace(/\s+/g, ' '));
}

/** Groupes de mots liés par le même mot ou le même tri (lien transitif), rangés selon leur premier mot. */
export function groupesDeDoublons(mots: Mot[]): Mot[][] {
  const tries = [...mots].sort(comparerMots);
  const parent = tries.map((_, i) => i);
  const racine = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const vus = new Map<string, number>();
  tries.forEach((m, i) => {
    for (const cle of [`m:${cleDoublon(m.mot)}`, `t:${cleDoublon(m.tri)}`]) {
      if (cle.length === 2) continue;
      const autre = vus.get(cle);
      if (autre === undefined) vus.set(cle, i);
      else parent[racine(i)] = racine(autre);
    }
  });
  const groupes = new Map<number, Mot[]>();
  tries.forEach((m, i) => {
    const r = racine(i);
    groupes.set(r, [...(groupes.get(r) ?? []), m]);
  });
  return [...groupes.values()].filter((g) => g.length > 1).sort((a, b) => comparerMots(a[0]!, b[0]!));
}

/** Nombre de mots de chaque filtre. */
export function compterFiltres(mots: Mot[]): Record<FiltreAtelier, number> {
  const complets = mots.filter(estComplet).length;
  return {
    tous: mots.length,
    complets,
    aCompleter: mots.length - complets,
    doublons: groupesDeDoublons(mots).flat().length,
  };
}

/** Les mots à montrer dans la liste de l'atelier, dans l'ordre du fichier (groupes entiers pour les doublons). */
export function listerAtelier(mots: Mot[], a: { filtre: FiltreAtelier; requete: string }): Mot[] {
  const requete = normaliser(a.requete.trim());
  const retenu = (m: Mot) => requete === '' || normaliser(m.mot).includes(requete) || normaliser(m.tri).includes(requete);
  switch (a.filtre) {
    case 'doublons':
      return groupesDeDoublons(mots).flat().filter(retenu);
    case 'complets':
      return mots.filter((m) => estComplet(m) && retenu(m)).sort(comparerMots);
    case 'aCompleter':
      return mots.filter((m) => !estComplet(m) && retenu(m)).sort(comparerMots);
    default:
      return mots.filter(retenu).sort(comparerMots);
  }
}

/** Genres déjà saisis : les plus employés d'abord, puis par ordre alphabétique ; sans la valeur vide. */
export function genresUtilises(mots: Mot[]): string[] {
  const emplois = new Map<string, number>();
  for (const m of mots) if (m.genre !== '') emplois.set(m.genre, (emplois.get(m.genre) ?? 0) + 1);
  return [...emplois.keys()].sort((x, y) => emplois.get(y)! - emplois.get(x)! || (x < y ? -1 : x > y ? 1 : 0));
}

/** Les autres mots de même mot, et ceux de même tri (mêmes comparaisons que les doublons). */
export function homonymes(mots: Mot[], fiche: Pick<Mot, 'id' | 'mot' | 'tri'>): { parMot: Mot[]; parTri: Mot[] } {
  const mot = cleDoublon(fiche.mot);
  const tri = cleDoublon(fiche.tri);
  const autres = mots.filter((m) => m.id !== fiche.id);
  return {
    parMot: mot === '' ? [] : autres.filter((m) => cleDoublon(m.mot) === mot),
    parTri: tri === '' ? [] : autres.filter((m) => cleDoublon(m.tri) === tri),
  };
}

/** Adresse de l'article du CNRTL pour un tri. */
export function adresseCnrtl(tri: string): string {
  return 'https://www.cnrtl.fr/definition/' + encodeURIComponent(rogner(tri));
}

/** Une fiche vide, à compléter. */
export function nouvelleFiche(id: string): Mot {
  return { id, mot: '', tri: '', genre: '', definition: '', sources: [], note: '', util: '', aCompleter: true };
}

/** Retire les espaces aux bords de `mot` et `tri` ; le reste de la fiche est gardé tel quel. */
export function nettoyerFiche(f: Mot): Mot {
  return { ...f, mot: rogner(f.mot), tri: rogner(f.tri) };
}

/** Remplace le mot de même identifiant, sinon l'ajoute. */
export function poserFiche(mots: Mot[], f: Mot): Mot[] {
  return mots.some((m) => m.id === f.id) ? mots.map((m) => (m.id === f.id ? f : m)) : [...mots, f];
}

/** Retire le mot de cet identifiant. */
export function retirerFiche(mots: Mot[], id: string): Mot[] {
  return mots.filter((m) => m.id !== id);
}

/** Une source par ligne non vide ; le texte de chaque ligne est gardé tel quel. */
export function lignesDeSources(texte: string): string[] {
  return texte.split(/\r?\n/).filter((l) => l.trim() !== '');
}
