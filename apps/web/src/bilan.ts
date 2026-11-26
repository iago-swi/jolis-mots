import type { EntreeHistorique } from '@jolis-mots/core';

/** « 1 139 mots », avec une espace fine insécable entre les milliers et une espace insécable avant « mots ». */
export function nombre(n: number): string {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${n > 1 ? 'mots' : 'mot'}`;
}

/** « +2 · ~1 · −1 » : les sortes absentes ne sont pas dites. */
export function bilan(e: EntreeHistorique): string {
  const parties: string[] = [];
  if (e.ajoutes.length > 0) parties.push(`+${e.ajoutes.length}`);
  if (e.modifies.length > 0) parties.push(`~${e.modifies.length}`);
  if (e.supprimes.length > 0) parties.push(`−${e.supprimes.length}`);
  return parties.join(' · ');
}

/** Ce que dit la bulle (conception, section 19) : une nouvelle liste et son bilan, ou le résultat d'une vérification. */
export type Annonce = { sorte: 'nouvelle'; entree: EntreeHistorique } | { sorte: 'a-jour' } | { sorte: 'hors-ligne' };

const TEXTES = {
  'a-jour': 'La liste est à jour',
  'hors-ligne': 'Pas de connexion. Réessaie plus tard',
} as const;

/** « Liste mise à jour · +2 · ~1 → 1 139 mots », « La liste est à jour » ou « Pas de connexion. Réessaie plus tard ». */
export function texteAnnonce(a: Annonce): string {
  if (a.sorte !== 'nouvelle') return TEXTES[a.sorte];
  return `Liste mise à jour · ${bilan(a.entree)} → ${nombre(a.entree.total)}`;
}

/** La même chose en toutes lettres, pour les lecteurs d'écran. */
export function annonceDite(a: Annonce): string {
  if (a.sorte !== 'nouvelle') return `${TEXTES[a.sorte]}.`;
  const e = a.entree;
  const parties: string[] = [];
  const dire = (n: number, s: string, p: string) => {
    if (n > 0) parties.push(`${n} ${n > 1 ? p : s}`);
  };
  dire(e.ajoutes.length, 'mot ajouté', 'mots ajoutés');
  dire(e.modifies.length, 'mot modifié', 'mots modifiés');
  dire(e.supprimes.length, 'mot supprimé', 'mots supprimés');
  return `Liste mise à jour : ${parties.join(', ')} ; ${nombre(e.total)}.`;
}
