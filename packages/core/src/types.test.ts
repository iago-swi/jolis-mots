import { expect, it } from 'vitest';
import { estComplet, type Mot } from './types';

const base: Mot = { id: 'a', mot: 'Accore', tri: 'accore', genre: 'adj.', definition: 'Abrupt.', sources: [], note: '', util: '', aCompleter: false };

it('un mot est complet avec une définition et sans marque « à compléter »', () => {
  expect(estComplet(base)).toBe(true);
  expect(estComplet({ ...base, definition: '   ' })).toBe(false);
  expect(estComplet({ ...base, aCompleter: true })).toBe(false);
});
