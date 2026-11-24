import { expect, it } from 'vitest';
import { marquerVu, motsDus, repondre } from './memoire';

const j = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));

it('fait monter un mot de case en case jusqu’à acquis', () => {
  let p = marquerVu({}, 'a', j(0));
  expect(p['a']).toMatchObject({ case: 1, acquis: false, du: j(1).toISOString() });
  p = repondre(p, 'a', true, j(1));
  expect(p['a']).toMatchObject({ case: 2, du: j(4).toISOString() });
  p = repondre(p, 'a', true, j(4));
  expect(p['a']).toMatchObject({ case: 3, du: j(11).toISOString() });
  p = repondre(p, 'a', true, j(11));
  expect(p['a']).toMatchObject({ case: 4, du: j(27).toISOString() });
  p = repondre(p, 'a', true, j(27));
  expect(p['a']).toMatchObject({ case: 5, du: j(62).toISOString() });
  p = repondre(p, 'a', true, j(62));
  expect(p['a']?.acquis).toBe(true);
  expect(motsDus(p, j(400))).toEqual([]);
});

it('renvoie un mot raté en case 1', () => {
  const p = repondre(repondre(marquerVu({}, 'a', j(0)), 'a', true, j(1)), 'a', false, j(4));
  expect(p['a']).toMatchObject({ case: 1, du: j(5).toISOString() });
});

it('liste les mots dus, du plus ancien au plus récent', () => {
  const p = marquerVu(marquerVu({}, 'a', j(2)), 'b', j(0));
  expect(motsDus(p, j(1))).toEqual(['b']);
  expect(motsDus(p, j(3))).toEqual(['b', 'a']);
});

it('ne modifie pas l’objet reçu', () => {
  const p = {};
  marquerVu(p, 'a', j(0));
  expect(p).toEqual({});
});

it('marquerVu est sans effet si le mot est déjà connu', () => {
  const p = repondre(marquerVu({}, 'a', j(0)), 'a', true, j(1));
  expect(marquerVu(p, 'a', j(9))).toEqual(p);
});

it('repondre sur un mot inconnu le crée d’abord comme vu', () => {
  const p = repondre({}, 'a', true, j(5));
  expect(p['a']).toMatchObject({ vu: j(5).toISOString(), case: 2, du: j(8).toISOString(), acquis: false });
});

it('un identifiant comme constructor n’est pas pris pour un mot connu', () => {
  const p = marquerVu({}, 'constructor', j(0));
  expect(p['constructor']).toMatchObject({ case: 1 });
});
