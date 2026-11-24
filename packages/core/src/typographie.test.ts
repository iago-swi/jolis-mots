import { describe, expect, it } from 'vitest';
import { embellir, entreGuillemets, tailleDuMot } from './typographie';

describe('typographie', () => {
  it('embellit sans toucher à la ponctuation haute', () => {
    expect(embellir("L'eau (...) charme; qui plaît")).toBe('L’eau (…) charme; qui plaît');
    expect(entreGuillemets('Nuit céruléenne.')).toBe('«\u202FNuit céruléenne.\u202F»');
    expect(entreGuillemets('« Déjà. »')).toBe('« Déjà. »');
  });

  it('réduit la taille des mots longs', () => {
    expect(tailleDuMot('Céruléen')).toBe(62);
    expect(tailleDuMot('Abracadabrantesque')).toBe(34);
    expect(tailleDuMot('Baguenauder')).toBe(51);
  });
});
