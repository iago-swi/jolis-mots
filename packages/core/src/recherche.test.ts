import { expect, it } from 'vitest';
import { filtrer, lettrine, normaliser, ordonner } from './recherche';
import type { Mot } from './types';

function mot(texte: string, tri: string, extra: Partial<Mot> = {}): Mot {
  return {
    id: `id-${texte}`,
    mot: texte,
    tri,
    genre: '',
    definition: 'une définition',
    sources: [],
    note: '',
    util: '',
    aCompleter: false,
    ...extra,
  };
}

it('retire accents et majuscules et redresse l’apostrophe courbe', () => {
  expect(normaliser('Éphémère')).toBe('ephemere');
  expect(normaliser('S’abolir')).toBe("s'abolir");
});

it('replie les ligatures œ et æ', () => {
  expect(normaliser('Œuvre')).toBe('oeuvre');
  expect(normaliser('Curriculum vitæ')).toBe('curriculum vitae');
});

it('cherche dans le mot et dans le tri', () => {
  const mots = [mot('S’aboucher (avec)', 'aboucher'), mot('Écrin', 'écrin')];
  expect(filtrer(mots, { requete: 'ecr', auteur: null, favoris: null }).map((m) => m.mot)).toEqual(['Écrin']);
  expect(filtrer(mots, { requete: 'ABOU', auteur: null, favoris: null })).toHaveLength(1);
});

it('une requête vide rend tout, dans l’ordre reçu', () => {
  const mots = [mot('Zèbre', 'zèbre'), mot('Abeille', 'abeille')];
  expect(filtrer(mots, { requete: '', auteur: null, favoris: null }).map((m) => m.mot)).toEqual(['Zèbre', 'Abeille']);
});

it('filtre par auteur et par favoris', () => {
  const b = mot('Bise', 'bise', { sources: ['Nicolas Bouvier: L’Usage du Monde (12)'] });
  const t = mot('Taïga', 'taiga', { sources: ['Sylvain Tesson: Dans les forêts de Sibérie'] });
  const mots = [b, t];
  expect(filtrer(mots, { requete: '', auteur: 'Nicolas Bouvier', favoris: null }).map((m) => m.id)).toEqual([b.id]);
  expect(filtrer(mots, { requete: '', auteur: null, favoris: [t.id] }).map((m) => m.id)).toEqual([t.id]);
  expect(filtrer(mots, { requete: '', auteur: null, favoris: [] })).toEqual([]);
  expect(filtrer(mots, { requete: 'bis', auteur: 'Sylvain Tesson', favoris: null })).toEqual([]);
});

it('donne la lettrine', () => {
  expect(lettrine(mot('Écrin', 'écrin'))).toBe('E');
  expect(lettrine(mot('1984', '1984'))).toBe('#');
  expect(lettrine(mot('Œuvre', 'œuvre'))).toBe('O');
});

it('ordonne selon le tri normalisé, puis le mot', () => {
  const mots = [mot('Écrin', 'écrin'), mot('Abeille', 'abeille'), mot('Œuvre', 'œuvre'), mot('Eau', 'eau')];
  expect(ordonner(mots).map((m) => m.mot)).toEqual(['Abeille', 'Eau', 'Écrin', 'Œuvre']);
  const egaux = [mot('b', 'x'), mot('a', 'x')];
  expect(ordonner(egaux).map((m) => m.mot)).toEqual(['a', 'b']);
  expect(mots[0]?.mot).toBe('Écrin');
});

it('trouve un livre à deux auteurs par chacun des auteurs', () => {
  const h = mot('Himal', 'himal', { sources: ['Alexandre Poussin & Sylvain Tesson: Himalaya (82)'] });
  expect(filtrer([h], { requete: '', auteur: 'Sylvain Tesson', favoris: null })).toEqual([h]);
  expect(filtrer([h], { requete: '', auteur: 'Alexandre Poussin', favoris: null })).toEqual([h]);
  expect(filtrer([h], { requete: '', auteur: 'Alexandre', favoris: null })).toEqual([]);
});
