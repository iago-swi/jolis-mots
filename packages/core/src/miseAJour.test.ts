import { expect, it } from 'vitest';
import { choisirListe } from './miseAJour';
import type { FichierMots } from './types';

const liste = (publie: string): FichierMots => ({ format: 1, publie, mots: [] });

it('adopte une liste valide plus récente', () => {
  expect(choisirListe(liste('2026-01-01T00:00:00Z'), liste('2026-02-01T00:00:00Z')).publie).toBe('2026-02-01T00:00:00Z');
});

it.each([
  [liste('2025-12-01T00:00:00Z')],
  [liste('2026-01-01T00:00:00Z')],
  ['<html>Not Found</html>'],
  [null],
  [{ format: 1, publie: '2027-01-01T00:00:00Z' }],
  [{ format: 1, publie: '2027-01-01T00:00:00Z', mots: [{ id: 1 }] }],
  [liste('pas une date')],
  [liste('')],
])('garde la liste en place devant %j', (recue) => {
  expect(choisirListe(liste('2026-01-01T00:00:00Z'), recue).publie).toBe('2026-01-01T00:00:00Z');
});

it('adopte une liste valide quand la date de la liste en place est illisible', () => {
  expect(choisirListe({ format: 1, publie: '', mots: [] }, liste('2026-02-01T00:00:00Z')).publie).toBe('2026-02-01T00:00:00Z');
});

it('rend la liste en place elle-même quand rien ne change', () => {
  const actuelle = liste('2026-01-01T00:00:00Z');
  expect(choisirListe(actuelle, null)).toBe(actuelle);
});
