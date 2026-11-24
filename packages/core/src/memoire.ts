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

/** Juste : monte d'une case (acquis après la case 5). Faux : retour en case 1. */
export function repondre(p: Progres, id: string, juste: boolean, maintenant: Date): Progres {
  const connu = marquerVu(p, id, maintenant);
  const etat = connu[id];
  if (!etat) return connu;
  if (!juste) {
    return { ...connu, [id]: { ...etat, case: 1, du: dans(INTERVALLES[0] ?? 1, maintenant), acquis: false } };
  }
  if (etat.case === 5) {
    return { ...connu, [id]: { ...etat, acquis: true } };
  }
  const suivante = (etat.case + 1) as EtatMot['case'];
  return { ...connu, [id]: { ...etat, case: suivante, du: dans(INTERVALLES[suivante - 1] ?? 1, maintenant), acquis: false } };
}

/** Identifiants des mots non acquis dont l'échéance est passée, du plus ancien au plus récent. */
export function motsDus(p: Progres, maintenant: Date): string[] {
  const limite = maintenant.toISOString();
  return Object.entries(p)
    .filter(([, e]) => !e.acquis && e.du <= limite)
    .sort(([, a], [, b]) => (a.du < b.du ? -1 : a.du > b.du ? 1 : 0))
    .map(([id]) => id);
}
