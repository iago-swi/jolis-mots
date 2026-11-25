import { describe, expect, it } from 'vitest';
import { motsAVerifier, motsInconnus, remarqueOrthographe } from './orthographe';

/** Un dictionnaire d'essai : seuls les mots de `inconnus` lui sont inconnus ; `absents` n'ont pas encore de réponse. */
function dico(inconnus: string[], absents: string[] = []) {
  return (mot: string): boolean | undefined => (absents.includes(mot) ? undefined : inconnus.includes(mot));
}

describe('motsAVerifier', () => {
  it('les mots de la définition, une fois chacun, sans les crochets, les balises ni les lettres seules', () => {
    expect(motsAVerifier('1. [Litt., rare] Qui a de la grâce. EX: Une grâce vénuste.\nSYN: joli, à')).toEqual([
      'Qui',
      'de',
      'la',
      'grâce',
      'Une',
      'vénuste',
      'joli',
    ]);
  });

  it('un mot composé ou élidé est demandé entier, puis par morceaux', () => {
    expect(motsAVerifier('Crois-moi, l’homme dit qu’en-dira-t-on.')).toEqual([
      'Crois-moi',
      'Crois',
      'moi',
      'l’homme',
      'homme',
      'dit',
      'qu’en-dira-t-on',
      'en',
      'dira',
      'on',
    ]);
  });

  it('les nombres et la ponctuation ne sont pas des mots', () => {
    expect(motsAVerifier('(12) – « ... » ; 1914')).toEqual([]);
  });
});

describe('motsInconnus', () => {
  it('rend les mots inconnus du dictionnaire, dans l’ordre, une fois chacun', () => {
    expect(motsInconnus('Une fautte, puis xyzzyq et fautte.', dico(['fautte', 'xyzzyq']))).toEqual(['fautte', 'xyzzyq']);
  });

  it('un mot sans réponse encore n’est pas signalé', () => {
    expect(motsInconnus('Une fautte.', dico(['fautte'], ['fautte']))).toEqual([]);
  });

  it('les abréviations à point, terminées par une consonne, ne sont pas signalées', () => {
    const d = dico(['fam', 'ext', 'qqn', 'qqch', 'etc', 'Synon', 'partic', 'acratopège']);
    expect(motsInconnus('Marmot (fam.), p. ext. chercher qqn ou qqch, etc. Synon. de gamin ; en partic. ici.', d)).toEqual([]);
    // Un mot inconnu qui finit par une voyelle, devant un point, reste signalé.
    expect(motsInconnus('Une voix acratopège.', d)).toEqual(['acratopège']);
    // Sans point, l'abréviation est un mot comme un autre.
    expect(motsInconnus('Un sens ext dit.', d)).toEqual(['ext']);
    // Un mot de plus de quatre lettres qui finit une phrase n'est pas une abréviation.
    const e = dico(['xyzzyq', 'ribleur', 'exagér']);
    expect(motsInconnus('Un xyzzyq. Puis un ribleur.\nEt exagér. au besoin.', e)).toEqual(['xyzzyq', 'ribleur']);
  });

  it('un nom propre (majuscule hors début de phrase) n’est pas signalé ; en début de phrase, le mot l’est', () => {
    const d = dico(['Farghestan', 'Oeil', 'Hypermnestre']);
    expect(motsInconnus('Le rivage du Farghestan, la fille d’Hypermnestre.', d)).toEqual([]);
    expect(motsInconnus('1. Oeil. EX: « Oeil pour oeil. »', d)).toEqual(['Oeil']);
    expect(motsInconnus('Farghestan est loin.', d)).toEqual(['Farghestan']);
  });

  it('un composé inconnu dont tous les morceaux sont connus n’est pas signalé', () => {
    const d = dico(['Crois-moi', 'l’extrême-droite', 'qu’en-dira-t-on', 'supersub-stantielle', 'supersub', 'stantielle']);
    expect(motsInconnus('Crois-moi, l’extrême-droite, le qu’en-dira-t-on.', d)).toEqual([]);
    expect(motsInconnus('Une âme supersub-stantielle.', d)).toEqual(['supersub-stantielle']);
  });

  it('le mot de la fiche et ses formes ne sont pas signalés : le dictionnaire ignore les mots rares', () => {
    const d = dico(['caristade', 'conjouir', 'conjouissent', 'sibile', 'fautte']);
    expect(motsInconnus('US: Donner la caristade, une fautte.', d, 'Caristade')).toEqual(['fautte']);
    expect(motsInconnus('EX: Se conjouir avec qqn ; ils se conjouissent.', d, 'Se conjouir avec')).toEqual([]);
    expect(motsInconnus('Le vent sibile.', d, 'Sibiler')).toEqual([]);
    const e = dico(['lactait', 'l’aure', 'aure']);
    expect(motsInconnus('Elle lactait.', e, 'Lacter')).toEqual([]);
    expect(motsInconnus('Ce que la langue appelait l’aure.', e, 'Aure')).toEqual([]);
    // Sans le mot de la fiche, tout est signalé.
    expect(motsInconnus('Le vent sibile.', d)).toEqual(['sibile']);
  });

  it('les mots entre crochets et les balises ne comptent pas', () => {
    expect(motsInconnus('[Vx, péjor.] Bête. EX: Une bête. ANTON: Malin.', dico(['Vx', 'péjor', 'EX', 'ANTON']))).toEqual([]);
  });
});

describe('remarqueOrthographe', () => {
  it('aucun mot : pas de remarque', () => {
    expect(remarqueOrthographe([])).toBeNull();
  });

  it('dit le ou les mots, sans correction', () => {
    expect(remarqueOrthographe(['fautte'])).toEqual({
      code: 'orthographe',
      texte: 'Mot inconnu du dictionnaire : fautte.',
      correction: null,
      mots: ['fautte'],
    });
    expect(remarqueOrthographe(['fautte', 'xyzzyq'])?.texte).toBe('Mots inconnus du dictionnaire : fautte, xyzzyq.');
  });
});
