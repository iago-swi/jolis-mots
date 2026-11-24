import { expect, it } from 'vitest';
import { marquerMontre, marquerVu, motsARevoir, motsDus, repondre, validerProgres } from './memoire';

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

it('repondre sur un mot inconnu l’entre en case 1 sans date de vue, quelle que soit la réponse', () => {
  const attendu = { vu: '', case: 1, du: j(6).toISOString(), acquis: false };
  expect(repondre({}, 'a', true, j(5))['a']).toEqual(attendu);
  expect(repondre({}, 'a', false, j(5))['a']).toEqual(attendu);
});

it('une bonne réponse sur un mot pas encore dû ne change rien', () => {
  const vu = marquerVu({}, 'a', j(0));
  expect(repondre(vu, 'a', true, j(0))).toBe(vu);
});

it('une bonne réponse sur un mot dû le fait monter en case 2, dû trois jours plus tard', () => {
  const vu = marquerVu({}, 'a', j(0));
  expect(repondre(vu, 'a', true, j(1))['a']).toMatchObject({ case: 2, du: j(4).toISOString() });
});

it('une mauvaise réponse, même sur un mot pas dû, renvoie en case 1', () => {
  const case3 = { a: { vu: j(0).toISOString(), case: 3 as const, du: j(9).toISOString(), acquis: false } };
  expect(repondre(case3, 'a', false, j(1))['a']).toMatchObject({ case: 1, du: j(2).toISOString(), acquis: false });
});

it('un mot acquis : juste ne change rien, faux le renvoie en case 1', () => {
  const acquis = { a: { vu: j(0).toISOString(), case: 5 as const, du: j(0).toISOString(), acquis: true } };
  expect(repondre(acquis, 'a', true, j(50))).toBe(acquis);
  expect(repondre(acquis, 'a', false, j(50))['a']).toMatchObject({ case: 1, acquis: false });
});

it('motsARevoir : les dus d’abord (le plus ancien en tête), puis les autres, jamais un acquis', () => {
  const e = (du: Date, acquis = false) => ({ vu: j(-9).toISOString(), case: 2 as const, du: du.toISOString(), acquis });
  const p = { d1: e(j(-2)), d2: e(j(-1)), n1: e(j(5)), n2: e(j(5)), q: e(j(-3), true) };
  expect(motsARevoir(p, j(0), () => 0).slice(0, 2)).toEqual(['d1', 'd2']);
  expect(new Set(motsARevoir(p, j(0), () => 0))).toEqual(new Set(['d1', 'd2', 'n1', 'n2']));
});

it('validerProgres garde les entrées valides et écarte le reste', () => {
  const a = marquerVu({}, 'a', j(0))['a'];
  expect(validerProgres({ x: 5, a, b: { ...a, case: 9 }, c: { ...a, du: 'demain' } })).toEqual({ a });
  expect(validerProgres({ d: { ...a, vu: 3 }, e: { ...a, acquis: 'oui' }, f: { ...a, case: 2.5 }, g: null })).toEqual({});
  expect(validerProgres([1, 2])).toEqual({});
  expect(validerProgres(null)).toEqual({});
  expect(validerProgres('texte')).toEqual({});
});

it('marquerMontre crée un mot inconnu comme marquerVu', () => {
  expect(marquerMontre({}, 'a', j(3))).toEqual(marquerVu({}, 'a', j(3)));
});

it('marquerMontre remet à jour la date de vue d’un mot connu sans toucher à sa case', () => {
  const avant = repondre(repondre(marquerVu({}, 'a', j(0)), 'a', true, j(1)), 'a', true, j(4));
  const apres = marquerMontre(avant, 'a', j(9));
  expect(apres['a']).toEqual({ ...avant['a'], vu: j(9).toISOString() });
  expect(avant['a']?.vu).toBe(j(0).toISOString());
});

it('un identifiant comme constructor n’est pas pris pour un mot connu', () => {
  const p = marquerVu({}, 'constructor', j(0));
  expect(p['constructor']).toMatchObject({ case: 1 });
});
