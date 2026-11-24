import { describe, expect, it } from 'vitest';
import { developperGenre, genreEstConnu, premierTerme } from './genre';

describe('genre', () => {
  it.each([
    ['adj.', 'adjectif'], ['subst. masc.', 'nom masculin'], ['subst. fém. plur.', 'nom féminin pluriel'],
    ['verbe trans.', 'verbe transitif'], ['verbe pronom.', 'verbe pronominal'], ['loc. adv.', 'locution adverbiale'],
    ['expr.', 'expression'], ['adj. + subst. masc.', 'adjectif et nom masculin'], ['subst. C2223', 'nom C2223'], ['', ''],
  ])('développe %s', (abrege, attendu) => expect(developperGenre(abrege)).toBe(attendu));

  it('donne le premier terme', () => {
    expect(premierTerme('subst. fém. plur.')).toBe('subst.');
    expect(premierTerme('verbe trans. + verbe intrans.')).toBe('verbe');
  });

  it('dit si tous les termes sont connus', () => {
    expect(genreEstConnu('subst. masc.')).toBe(true);
    expect(genreEstConnu('adj. + subst. masc.')).toBe(true);
    expect(genreEstConnu('')).toBe(true);
    expect(genreEstConnu('subst. C2223')).toBe(false);
  });
});
