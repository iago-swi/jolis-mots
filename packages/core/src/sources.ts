import type { Mot } from './types';

export interface Source {
  auteur: string | null;
  titre: string;
  pages: string | null;
}

/** Lit une ligne de source : « Auteur: Titre (pages) ». */
export function lireSource(ligne: string): Source {
  const coupe = ligne.indexOf(': ');
  const auteur = coupe === -1 ? null : ligne.slice(0, coupe).trim();
  const reste = coupe === -1 ? ligne.trim() : ligne.slice(coupe + 2).trim();
  const m = /^(.*?)\s*\(([\d,\s-]+)\)$/.exec(reste);
  if (!m) return { auteur, titre: reste, pages: null };
  return { auteur, titre: m[1] ?? '', pages: (m[2] ?? '').trim() };
}

/** « 82,319 » devient « p. 82, 319 ». */
export function afficherPages(pages: string): string {
  return 'p. ' + pages.split(',').map((p) => p.trim()).join(', ');
}

/** Nombre de mots par auteur (un mot compte une fois par auteur), du plus au moins cité. */
export function auteursParNombre(mots: Mot[]): { auteur: string; nombre: number }[] {
  const comptes = new Map<string, number>();
  for (const m of mots) {
    const auteurs = new Set<string>();
    for (const ligne of m.sources) {
      const { auteur } = lireSource(ligne);
      if (auteur) auteurs.add(auteur);
    }
    for (const a of auteurs) comptes.set(a, (comptes.get(a) ?? 0) + 1);
  }
  return [...comptes]
    .map(([auteur, nombre]) => ({ auteur, nombre }))
    .sort((a, b) => b.nombre - a.nombre || a.auteur.localeCompare(b.auteur, 'fr'));
}
