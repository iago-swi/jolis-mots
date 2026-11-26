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

/** « Liste mise à jour · +2 · ~1 → 1 139 mots » : le texte de l'annonce, à l'écran Mot comme à l'historique. */
export function annonce(e: EntreeHistorique): string {
  return `Liste mise à jour · ${bilan(e)} → ${nombre(e.total)}`;
}

/** La même annonce en toutes lettres, pour les lecteurs d'écran. */
export function annonceDite(e: EntreeHistorique): string {
  const parties: string[] = [];
  const dire = (n: number, s: string, p: string) => {
    if (n > 0) parties.push(`${n} ${n > 1 ? p : s}`);
  };
  dire(e.ajoutes.length, 'mot ajouté', 'mots ajoutés');
  dire(e.modifies.length, 'mot modifié', 'mots modifiés');
  dire(e.supprimes.length, 'mot supprimé', 'mots supprimés');
  return `Liste mise à jour : ${parties.join(', ')} ; ${nombre(e.total)}.`;
}
