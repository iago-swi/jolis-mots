import { describe, expect, it } from 'vitest';
import {
  embellir,
  entreGuillemets,
  LETTRES_SUR_UNE_LIGNE,
  TAILLE_DU_MOT,
  TAILLE_DU_MOT_LONG,
  tailleDuMot,
} from './typographie';

describe('typographie', () => {
  it('embellit sans toucher à la ponctuation haute', () => {
    expect(embellir("L'eau (...) charme; qui plaît")).toBe('L’eau (…) charme; qui plaît');
    expect(entreGuillemets('Nuit céruléenne.')).toBe('«\u202FNuit céruléenne.\u202F»');
    expect(entreGuillemets('« Déjà. »')).toBe('« Déjà. »');
  });

  it('compose le mot à une seule taille, sauf un morceau trop long pour une ligne', () => {
    expect(tailleDuMot('Vénuste')).toBe(TAILLE_DU_MOT);
    expect(tailleDuMot('Baguenauder')).toBe(TAILLE_DU_MOT); // 11 lettres : plus de dégradé
    expect(tailleDuMot('Grosjean comme devant')).toBe(TAILLE_DU_MOT); // expression : la longueur totale ne compte pas
    expect(tailleDuMot('Béni-oui-oui')).toBe(TAILLE_DU_MOT); // le trait d'union coupe les morceaux
    expect(tailleDuMot('Abracadabrantesque')).toBe(TAILLE_DU_MOT_LONG);
    expect(tailleDuMot('x'.repeat(LETTRES_SUR_UNE_LIGNE))).toBe(TAILLE_DU_MOT);
    expect(tailleDuMot('x'.repeat(LETTRES_SUR_UNE_LIGNE + 1))).toBe(TAILLE_DU_MOT_LONG);
    expect(tailleDuMot('Sans ' + 'x'.repeat(LETTRES_SUR_UNE_LIGNE + 1))).toBe(TAILLE_DU_MOT_LONG);
    expect(tailleDuMot('')).toBe(TAILLE_DU_MOT);
  });

  it('ne donne jamais d’autre taille que les deux', () => {
    for (const m of ['A', 'Éployer', 'Circonvolution', "N'avoir (pas / point) de cesse que + subj."]) {
      expect([TAILLE_DU_MOT, TAILLE_DU_MOT_LONG]).toContain(tailleDuMot(m));
    }
  });
});
