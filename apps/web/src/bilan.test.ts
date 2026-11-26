import type { EntreeHistorique } from '@jolis-mots/core';
import { describe, expect, it } from 'vitest';
import { annonce, annonceDite, bilan, nombre } from './bilan';

function entree(ajoutes: number, modifies: number, supprimes: number, total: number): EntreeHistorique {
  const mots = (n: number, p: string) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, mot: `${p}${i}` }));
  return {
    publie: '2026-11-26T10:00:00Z',
    debut: false,
    total,
    ajoutes: mots(ajoutes, 'a'),
    modifies: mots(modifies, 'm'),
    supprimes: mots(supprimes, 's'),
  };
}

describe('le bilan d’une nouvelle liste', () => {
  it('sépare les milliers par une espace fine insécable, et met une espace insécable avant « mots »', () => {
    expect(nombre(1139)).toBe('1 139 mots');
    expect(nombre(1)).toBe('1 mot');
  });

  it('ne dit que les sortes présentes', () => {
    expect(bilan(entree(2, 0, 1, 10))).toBe('+2 · −1');
  });

  it('donne le même texte d’annonce à l’écran Mot et à l’historique', () => {
    expect(annonce(entree(2, 1, 0, 1139))).toBe('Liste mise à jour · +2 · ~1 → 1 139 mots');
  });

  it('dit l’annonce en toutes lettres pour les lecteurs d’écran', () => {
    expect(annonceDite(entree(1, 2, 0, 1139))).toBe(
      'Liste mise à jour : 1 mot ajouté, 2 mots modifiés ; 1 139 mots.'
    );
  });
});
