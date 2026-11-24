import { describe, expect, it } from 'vitest';
import { afficherPages, auteursDe, auteursParNombre, lireSource, nomCourt } from './sources';
import type { Mot } from './types';

const mot = (id: string, sources: string[]): Mot => ({
  id, mot: id, tri: id, genre: '', definition: 'x', sources, note: '', util: '', aCompleter: false,
});

describe('sources', () => {
  it('lit auteur, titre et pages', () => {
    expect(lireSource('Nicolas Bouvier: Le Poisson-Scorpion (172)')).toEqual({ auteur: 'Nicolas Bouvier', titre: 'Le Poisson-Scorpion', pages: '172' });
    expect(lireSource("Nicolas Bouvier: L'Usage du Monde (82,319)").pages).toBe('82,319');
    expect(lireSource('Dictionnaire des mots savants (employés à tort et à travers)')).toEqual({ auteur: null, titre: 'Dictionnaire des mots savants (employés à tort et à travers)', pages: null });
    expect(lireSource('Anne Marie Jaton: Nicolas Bouvier. Paroles du monde').auteur).toBe('Anne Marie Jaton');
  });

  it('affiche les pages', () => expect(afficherPages('82,319')).toBe('p. 82, 319'));

  it('compte les mots par auteur, une fois par mot', () => {
    const mots = [
      mot('a', ['Nicolas Bouvier: Le Poisson-Scorpion (172)', 'Nicolas Bouvier: L\'Usage du Monde (82)']),
      mot('b', ['Nicolas Bouvier: Chronique japonaise']),
      mot('c', ['Anne Marie Jaton: Paroles du monde', 'Dictionnaire des mots savants']),
    ];
    expect(auteursParNombre(mots)).toEqual([
      { auteur: 'Nicolas Bouvier', nombre: 2 },
      { auteur: 'Anne Marie Jaton', nombre: 1 },
    ]);
  });

  it('trie à égalité par ordre alphabétique', () => {
    const mots = [mot('a', ['Zoé: T']), mot('b', ['Alice: T'])];
    expect(auteursParNombre(mots).map((x) => x.auteur)).toEqual(['Alice', 'Zoé']);
  });

  it('sépare les auteurs d’une ligne', () => {
    expect(auteursDe('Alexandre Poussin & Sylvain Tesson: Himalaya (82)')).toEqual(['Alexandre Poussin', 'Sylvain Tesson']);
    expect(auteursDe('Nicolas Bouvier: Le Poisson-Scorpion (172)')).toEqual(['Nicolas Bouvier']);
    expect(auteursDe('Dictionnaire des mots savants')).toEqual([]);
  });

  it('donne le nom court d’un auteur : son dernier mot', () => {
    expect(nomCourt('Nicolas Bouvier')).toBe('Bouvier');
    expect(nomCourt('Anne Marie Jaton')).toBe('Jaton');
    expect(nomCourt('Homère')).toBe('Homère');
  });

  it('compte un livre à deux auteurs pour chacun', () => {
    const mots = [mot('a', ['Alexandre Poussin & Sylvain Tesson: Himalaya (82)']), mot('b', ['Sylvain Tesson: Dans les forêts'])];
    expect(auteursParNombre(mots)).toEqual([
      { auteur: 'Sylvain Tesson', nombre: 2 },
      { auteur: 'Alexandre Poussin', nombre: 1 },
    ]);
  });
});
