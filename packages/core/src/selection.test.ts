import { expect, it } from 'vitest';
import type { EtatMot } from './memoire';
import { prochainMot } from './selection';
import type { Mot } from './types';

function mot(texte: string, tri: string): Mot {
  return { id: `id-${texte}`, mot: texte, tri, genre: '', definition: 'd', sources: [], note: '', util: '', aCompleter: false };
}

function etat(vu: string): EtatMot {
  return { vu, case: 1, du: vu, acquis: false };
}

it('tire un mot jamais vu, puis le plus anciennement vu, puis rien', () => {
  const [a, b] = [mot('A', 'a'), mot('B', 'b')];
  expect(prochainMot([a, b], { [a.id]: etat('2026-01-01') }, [], () => 0)?.id).toBe(b.id);
  expect(prochainMot([a, b], { [a.id]: etat('2026-01-01'), [b.id]: etat('2026-02-01') }, [], () => 0)?.id).toBe(a.id);
  expect(prochainMot([a], {}, [a.id], () => 0)).toBeNull();
  expect(prochainMot([], {}, [], () => 0)).toBeNull();
});

it('choisit le plus anciennement vu même s’il vient après dans la liste', () => {
  const [a, b] = [mot('A', 'a'), mot('B', 'b')];
  expect(prochainMot([a, b], { [a.id]: etat('2026-02-01'), [b.id]: etat('2026-01-01') }, [], () => 0)?.id).toBe(b.id);
});

it('choisit le plus anciennement vu parmi trois mots vus', () => {
  const [a, b, c] = [mot('A', 'a'), mot('B', 'b'), mot('C', 'c')];
  const progres = { [a.id]: etat('2026-02-01'), [b.id]: etat('2026-03-01'), [c.id]: etat('2026-01-01') };
  expect(prochainMot([a, b, c], progres, [], () => 0)?.id).toBe(c.id);
});

it('exclut les mots de la séance et utilise le hasard fourni', () => {
  const [a, b, c] = [mot('A', 'a'), mot('B', 'b'), mot('C', 'c')];
  expect(prochainMot([a, b, c], {}, [a.id], () => 0)?.id).toBe(b.id);
  expect(prochainMot([a, b, c], {}, [a.id], () => 0.99)?.id).toBe(c.id);
});

it('parmi les mots déjà vus, ignore ceux de la séance', () => {
  const [a, b] = [mot('A', 'a'), mot('B', 'b')];
  const progres = { [a.id]: etat('2026-01-01'), [b.id]: etat('2026-02-01') };
  expect(prochainMot([a, b], progres, [a.id], () => 0)?.id).toBe(b.id);
});
