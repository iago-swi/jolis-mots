import type { FichierMots, Mot } from './types';

/** Ce qui a changé depuis la dernière liste envoyée. */
export interface Modifications {
  ajoutes: number;
  modifies: number;
  supprimes: number;
  total: number;
}

function identiques(x: Mot, y: Mot): boolean {
  return (
    x.mot === y.mot &&
    x.tri === y.tri &&
    x.genre === y.genre &&
    x.definition === y.definition &&
    x.note === y.note &&
    x.util === y.util &&
    x.aCompleter === y.aCompleter &&
    x.sources.length === y.sources.length &&
    x.sources.every((s, i) => s === y.sources[i])
  );
}

/** Compte les mots ajoutés, modifiés et supprimés, appariés par identifiant. */
export function compterModifications(envoyes: Mot[], locaux: Mot[]): Modifications {
  const avant = new Map(envoyes.map((m) => [m.id, m]));
  const ids = new Set(locaux.map((m) => m.id));
  let ajoutes = 0;
  let modifies = 0;
  for (const m of locaux) {
    const ancien = avant.get(m.id);
    if (!ancien) ajoutes++;
    else if (!identiques(ancien, m)) modifies++;
  }
  const supprimes = envoyes.filter((m) => !ids.has(m.id)).length;
  return { ajoutes, modifies, supprimes, total: ajoutes + modifies + supprimes };
}

/** « 3 mots modifiés, 1 ajouté » ; chaîne vide quand rien n'a changé. */
export function decrireModifications(m: Modifications): string {
  const parties: string[] = [];
  // Le mot « mot » n'apparaît qu'une fois, devant le premier groupe.
  const ajouter = (n: number, singulier: string, pluriel: string) => {
    if (n === 0) return;
    const accord = n === 1 ? singulier : pluriel;
    parties.push(`${n} ${parties.length === 0 ? (n === 1 ? 'mot ' : 'mots ') : ''}${accord}`);
  };
  ajouter(m.modifies, 'modifié', 'modifiés');
  ajouter(m.ajoutes, 'ajouté', 'ajoutés');
  ajouter(m.supprimes, 'supprimé', 'supprimés');
  return parties.join(', ');
}

/** Le message de version : date longue (heure locale) puis le détail. */
export function messageDEnvoi(m: Modifications, date: Date): string {
  const jour = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long' }).format(date);
  const detail = decrireModifications(m);
  return detail ? `Liste du ${jour} : ${detail}` : `Liste du ${jour}`;
}

/** Les problèmes qui empêchent l'envoi, en phrases ; vide quand la liste peut partir. */
export function validerPourEnvoi(f: FichierMots): string[] {
  const phrases: string[] = [];
  if (f.mots.length === 0) phrases.push('La liste est vide.');
  if (f.mots.some((m) => m.id === '')) phrases.push("Un mot n'a pas d'identifiant.");
  const vus = new Set<string>();
  const doublons = new Set<string>();
  for (const m of f.mots) {
    if (m.id === '') continue;
    if (vus.has(m.id)) doublons.add(m.id);
    vus.add(m.id);
  }
  for (const id of doublons) phrases.push(`Deux mots portent le même identifiant (${id}).`);
  for (const m of f.mots) {
    if (m.mot.trim() === '') phrases.push(`Un mot n'a pas de nom (identifiant ${m.id}).`);
  }
  return phrases;
}

/** Date l'envoi : `publie` en ISO sans millisecondes. */
export function dater(f: FichierMots, maintenant: Date): FichierMots {
  return { ...f, publie: maintenant.toISOString().replace(/\.\d{3}Z$/, 'Z') };
}
