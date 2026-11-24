import type { Progres } from './memoire';
import type { Mot } from './types';

/**
 * Choisit le prochain mot à montrer : au hasard parmi ceux que l'on n'a jamais vus
 * (absents de `progres` et de `seance`, ou dont `vu` est vide : rencontrés seulement au quiz),
 * sinon le plus anciennement vu hors `seance`, sinon `null`.
 */
export function prochainMot(complets: Mot[], progres: Progres, seance: string[], alea: () => number): Mot | null {
  const dejaMontres = new Set(seance);
  const hors = complets.filter((m) => !dejaMontres.has(m.id));
  const neufs = hors.filter((m) => !Object.hasOwn(progres, m.id) || progres[m.id]?.vu === '');
  if (neufs.length > 0) return neufs[Math.min(Math.floor(alea() * neufs.length), neufs.length - 1)] ?? null;
  let plusAncien: Mot | null = null;
  let dateAncien = '';
  for (const m of hors) {
    const vu = progres[m.id]?.vu ?? '';
    if (plusAncien === null || vu < dateAncien) {
      plusAncien = m;
      dateAncien = vu;
    }
  }
  return plusAncien;
}
