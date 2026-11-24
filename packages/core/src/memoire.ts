import { melanger } from './hasard';

/** État d'un mot dans la mémoire de l'utilisateur (dates ISO). */
export interface EtatMot {
  vu: string;
  case: 1 | 2 | 3 | 4 | 5;
  du: string;
  acquis: boolean;
}

/** Progrès par identifiant de mot. */
export type Progres = Record<string, EtatMot>;

/** Délai, en jours, avant qu'un mot revienne, selon sa case (1 à 5). */
export const INTERVALLES: readonly number[] = [1, 3, 7, 16, 35];

const JOUR_MS = 24 * 60 * 60 * 1000;

function dans(jours: number, depuis: Date): string {
  return new Date(depuis.getTime() + jours * JOUR_MS).toISOString();
}

/** Un mot vu entre en case 1, dû un jour plus tard. Sans effet si le mot est déjà connu. */
export function marquerVu(p: Progres, id: string, maintenant: Date): Progres {
  if (Object.hasOwn(p, id)) return p;
  return {
    ...p,
    [id]: { vu: maintenant.toISOString(), case: 1, du: dans(INTERVALLES[0] ?? 1, maintenant), acquis: false },
  };
}

/**
 * Un mot montré sur l'écran Mot : créé comme par `marquerVu` s'il est inconnu, sinon seule sa date
 * de vue passe à `maintenant` (case, échéance et acquis ne bougent pas). Ainsi, une fois tous les mots
 * vus, `prochainMot` reprend ceux vus il y a le plus longtemps.
 */
export function marquerMontre(p: Progres, id: string, maintenant: Date): Progres {
  const etat = Object.hasOwn(p, id) ? p[id] : undefined;
  if (!etat) return marquerVu(p, id, maintenant);
  return { ...p, [id]: { ...etat, vu: maintenant.toISOString() } };
}

/**
 * Un mot inconnu entre en case 1 sans date de vue (`vu: ''`, il reste « à lire »), dû un jour plus tard,
 * quelle que soit la réponse. Pour un mot connu : faux, retour en case 1 ; juste, le mot ne monte d'une case
 * (acquis après la case 5) que s'il est dû, sinon rien ne change et `p` est rendu tel quel.
 */
export function repondre(p: Progres, id: string, juste: boolean, maintenant: Date): Progres {
  const etat = Object.hasOwn(p, id) ? p[id] : undefined;
  const demain = dans(INTERVALLES[0] ?? 1, maintenant);
  if (!etat) return { ...p, [id]: { vu: '', case: 1, du: demain, acquis: false } };
  if (!juste) return { ...p, [id]: { ...etat, case: 1, du: demain, acquis: false } };
  if (etat.acquis || etat.du > maintenant.toISOString()) return p;
  if (etat.case === 5) return { ...p, [id]: { ...etat, acquis: true } };
  const suivante = (etat.case + 1) as EtatMot['case'];
  return { ...p, [id]: { ...etat, case: suivante, du: dans(INTERVALLES[suivante - 1] ?? 1, maintenant), acquis: false } };
}

/** Identifiants des mots non acquis dont l'échéance est passée, du plus ancien au plus récent. */
export function motsDus(p: Progres, maintenant: Date): string[] {
  const limite = maintenant.toISOString();
  return Object.entries(p)
    .filter(([, e]) => !e.acquis && e.du <= limite)
    .sort(([, a], [, b]) => (a.du < b.du ? -1 : a.du > b.du ? 1 : 0))
    .map(([id]) => id);
}

/** Mots non acquis à revoir : d'abord les dus (ordre de `motsDus`), puis les autres, mélangés avec `alea`. */
export function motsARevoir(p: Progres, maintenant: Date, alea: () => number): string[] {
  const dus = motsDus(p, maintenant);
  const dejaDus = new Set(dus);
  const autres = Object.entries(p)
    .filter(([id, e]) => !e.acquis && !dejaDus.has(id))
    .map(([id]) => id);
  return [...dus, ...melanger(autres, alea)];
}

function estEtatValide(e: unknown): e is EtatMot {
  if (typeof e !== 'object' || e === null || Array.isArray(e)) return false;
  const { vu, case: c, du, acquis } = e as Record<string, unknown>;
  return (
    typeof vu === 'string' &&
    typeof c === 'number' &&
    Number.isInteger(c) &&
    c >= 1 &&
    c <= 5 &&
    typeof du === 'string' &&
    !Number.isNaN(new Date(du).getTime()) &&
    typeof acquis === 'boolean'
  );
}

/** Progrès lus d'un stockage : garde les entrées bien formées, écarte le reste ; `{}` si ce n'est pas un objet simple. */
export function validerProgres(x: unknown): Progres {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return {};
  const r: Progres = {};
  for (const [id, e] of Object.entries(x)) {
    if (estEtatValide(e)) r[id] = { vu: e.vu, case: e.case, du: e.du, acquis: e.acquis };
  }
  return r;
}
