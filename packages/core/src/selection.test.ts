import { expect, it } from 'vitest';
import { marquerMontre, repondre, type EtatMot, type Progres } from './memoire';
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

it('une fois tous les mots vus, les passe tous avant d’en reprendre un', () => {
  const [a, b, c] = [mot('A', 'a'), mot('B', 'b'), mot('C', 'c')];
  let progres: Progres = { [a.id]: etat('2026-01-01'), [b.id]: etat('2026-01-02'), [c.id]: etat('2026-01-03') };
  const tires: string[] = [];
  for (let n = 0; n < 6; n++) {
    // Chaque tirage ouvre une nouvelle séance : seule la mémoire relie les tirages.
    const m = prochainMot([a, b, c], progres, [], () => 0);
    if (m === null) throw new Error('aucun mot tiré');
    tires.push(m.id);
    progres = marquerMontre(progres, m.id, new Date(Date.UTC(2026, 1, 1 + n)));
  }
  expect(tires).toEqual([a.id, b.id, c.id, a.id, b.id, c.id]);
});

it('parmi les mots déjà vus, ignore ceux de la séance', () => {
  const [a, b] = [mot('A', 'a'), mot('B', 'b')];
  const progres = { [a.id]: etat('2026-01-01'), [b.id]: etat('2026-02-01') };
  expect(prochainMot([a, b], progres, [a.id], () => 0)?.id).toBe(b.id);
});

it('un mot rencontré seulement au quiz reste à lire, comme un mot neuf', () => {
  const [m1, m2] = [mot('A', 'a'), mot('B', 'b')];
  const quizSeul = repondre({}, m1.id, true, new Date(Date.UTC(2026, 10, 24)));
  expect(prochainMot([m1], quizSeul, [], () => 0)).toBe(m1);
  // m2 est neuf, m1 vu seulement au quiz : les deux sont à lire, le hasard tranche
  expect(prochainMot([m1, m2], quizSeul, [], () => 0)).toBe(m1);
  expect(prochainMot([m1, m2], quizSeul, [], () => 0.99)).toBe(m2);
});

it('parmi des mots tous montrés, sort le plus anciennement vu', () => {
  const [m1, m2] = [mot('A', 'a'), mot('B', 'b')];
  const tousVus = { [m1.id]: etat('2026-11-23'), [m2.id]: etat('2026-11-21') };
  expect(prochainMot([m1, m2], tousVus, [], () => 0)).toBe(m2);
});
