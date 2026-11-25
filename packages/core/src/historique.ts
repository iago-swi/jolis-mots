import { normaliser } from './recherche';
import { estComplet, type FichierMots, type Mot } from './types';

/** Un mot cité dans l'historique : son identifiant et le mot tel qu'il était affiché. */
export interface MotNote {
  id: string;
  mot: string;
}

/** Une liste notée par l'appareil (conception, section 14). */
export interface EntreeHistorique {
  /** La date `publie` de la liste : l'heure de l'envoi depuis l'atelier. */
  publie: string;
  /** La première liste notée par l'appareil : elle n'a rien à comparer. */
  debut: boolean;
  /** Nombre de mots complets. */
  total: number;
  ajoutes: MotNote[];
  modifies: MotNote[];
  supprimes: MotNote[];
}

/**
 * La dernière liste notée, réduite à ce qui sert à comparer : pour chaque mot complet,
 * le mot affiché et une empreinte de ce que le téléphone en montre.
 */
export interface Reference {
  publie: string;
  mots: Record<string, [mot: string, empreinte: number]>;
}

/** Nombre d'entrées gardées ; au-delà, les plus anciennes partent. */
export const HISTORIQUE_MAX = 200;

/** Empreinte FNV-1a (32 bits) de ce qu'un mot montre : mot, genre, définition, sources. */
function empreinte(m: Mot): number {
  const texte = [m.mot, m.genre, m.definition, m.sources.join('\u0001')].join('\u0000');
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** La référence d'une liste : ses mots complets. */
export function referenceDe(f: FichierMots): Reference {
  const mots: Reference['mots'] = Object.create(null);
  for (const m of f.mots) if (estComplet(m)) mots[m.id] = [m.mot, empreinte(m)];
  return { publie: f.publie, mots };
}

function ordre(a: MotNote, b: MotNote): number {
  const na = normaliser(a.mot);
  const nb = normaliser(b.mot);
  return na < nb ? -1 : na > nb ? 1 : a.mot < b.mot ? -1 : a.mot > b.mot ? 1 : 0;
}

/**
 * Note la liste `f` si elle est plus récente que la dernière notée (une liste plus ancienne,
 * comme celle embarquée dans l'application au lancement, ne fait pas reculer l'historique). La première liste ouvre
 * l'historique ; les suivantes y ajoutent une entrée quand un mot visible a changé.
 * Ne modifie rien : rend l'historique et la référence à garder (les mêmes objets si rien ne change).
 */
export function noterListe(
  historique: EntreeHistorique[],
  reference: Reference | null,
  f: FichierMots,
): { historique: EntreeHistorique[]; reference: Reference } {
  if (reference !== null && !(Date.parse(f.publie) > Date.parse(reference.publie))) return { historique, reference };
  const nouvelle = referenceDe(f);
  const total = Object.keys(nouvelle.mots).length;
  if (reference === null) {
    const debut: EntreeHistorique = { publie: f.publie, debut: true, total, ajoutes: [], modifies: [], supprimes: [] };
    return { historique: historique.length === 0 ? [debut] : historique, reference: nouvelle };
  }
  const ajoutes: MotNote[] = [];
  const modifies: MotNote[] = [];
  const supprimes: MotNote[] = [];
  for (const [id, [motAffiche, e]] of Object.entries(nouvelle.mots)) {
    const avant = Object.hasOwn(reference.mots, id) ? reference.mots[id] : undefined;
    if (avant === undefined) ajoutes.push({ id, mot: motAffiche });
    else if (avant[1] !== e) modifies.push({ id, mot: motAffiche });
  }
  for (const [id, [motAffiche]] of Object.entries(reference.mots)) {
    if (!Object.hasOwn(nouvelle.mots, id)) supprimes.push({ id, mot: motAffiche });
  }
  if (ajoutes.length + modifies.length + supprimes.length === 0) return { historique, reference: nouvelle };
  const entree: EntreeHistorique = {
    publie: f.publie,
    debut: false,
    total,
    ajoutes: ajoutes.sort(ordre),
    modifies: modifies.sort(ordre),
    supprimes: supprimes.sort(ordre),
  };
  return { historique: [...historique, entree].slice(-HISTORIQUE_MAX), reference: nouvelle };
}

function estMotNote(x: unknown): x is MotNote {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.mot === 'string';
}

function estEntree(x: unknown): x is EntreeHistorique {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.publie === 'string' &&
    typeof o.debut === 'boolean' &&
    typeof o.total === 'number' &&
    [o.ajoutes, o.modifies, o.supprimes].every((l) => Array.isArray(l) && l.every(estMotNote))
  );
}

/** L'historique gardé sur l'appareil, sans les entrées qui n'ont pas la bonne forme. */
export function validerHistorique(x: unknown): EntreeHistorique[] {
  return Array.isArray(x) ? x.filter(estEntree) : [];
}

/** La référence gardée sur l'appareil, ou null si elle n'a pas la bonne forme. */
export function validerReference(x: unknown): Reference | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.publie !== 'string' || typeof o.mots !== 'object' || o.mots === null || Array.isArray(o.mots)) return null;
  const mots: Reference['mots'] = Object.create(null);
  for (const [id, v] of Object.entries(o.mots)) {
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'string' || typeof v[1] !== 'number') return null;
    mots[id] = [v[0], v[1]];
  }
  return { publie: o.publie, mots };
}
