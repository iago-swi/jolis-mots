import { expect, it } from 'vitest';
import { normaliser } from './recherche';

it('retire accents et majuscules et redresse l’apostrophe courbe', () => {
  expect(normaliser('Éphémère')).toBe('ephemere');
  expect(normaliser('S’abolir')).toBe("s'abolir");
});
