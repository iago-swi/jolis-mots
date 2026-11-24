import { describe, expect, it } from 'vitest';
import { importer, rapportEnMarkdown, type LigneExcel } from './import';

const ligne = (p: Partial<LigneExcel>): LigneExcel => ({ mot: '', tri: '', genre: '', definition: '', note: '', util: '', source: '', rouge: false, ...p });
let n = 0;
const options = () => ({ publie: '2026-11-24T10:00:00Z', creerId: () => `id${++n}` });

describe('importer', () => {
  it('marque « à compléter » et retire les dièses sans perdre le texte', () => {
    const { fichier } = importer([
      ligne({ mot: 'Impresse', tri: 'impresse', genre: '### adj.' }),
      ligne({ mot: 'Ecluser', tri: 'ecluser', genre: '###', definition: '(biere)' }),
      ligne({ mot: 'Quitus', tri: 'quitus', genre: 'subst. masc.', definition: '###' }),
      ligne({ mot: 'Hiémal', tri: 'hiémal', genre: '###', definition: "Qui appartient à l'hiver." }),
      ligne({ mot: 'Accore', tri: 'accore', genre: 'adj.', definition: 'Abrupt.' }),
    ], options());
    const par = Object.fromEntries(fichier.mots.map((m) => [m.mot, m]));
    expect(par['Impresse']).toMatchObject({ genre: 'adj.', definition: '', aCompleter: true });
    expect(par['Ecluser']).toMatchObject({ genre: '', definition: '(biere)', aCompleter: true });
    expect(par['Quitus']).toMatchObject({ genre: 'subst. masc.', definition: '', aCompleter: true });
    expect(par['Hiémal']).toMatchObject({ definition: "Qui appartient à l'hiver.", aCompleter: true });
    expect(par['Accore']?.aCompleter).toBe(false);
  });

  it('nettoie les espaces insécables et les sources', () => {
    const { fichier } = importer([ligne({ mot: 'épure ', tri: 'épure ', source: 'A: T (1)\n-\n\nB: U' })], options());
    expect(fichier.mots[0]).toMatchObject({ mot: 'épure', tri: 'épure', sources: ['A: T (1)', 'B: U'] });
  });

  it('fusionne un doublon vide avec la fiche complète, sauf en rouge', () => {
    const { fichier, rapport } = importer([
      ligne({ mot: 'Cacique', tri: 'cacique', genre: 'subst. masc.', definition: 'Chef.', source: 'A: T' }),
      ligne({ mot: 'cacique ', tri: 'cacique', genre: '###', source: 'B: U' }),
      ligne({ mot: 'Cave', tri: 'cave', genre: 'adj.', definition: 'Niais.', rouge: true }),
      ligne({ mot: 'Cave', tri: 'cave', genre: '###', rouge: true }),
    ], options());
    expect(fichier.mots.filter((m) => m.tri === 'cacique')).toHaveLength(1);
    expect(fichier.mots.find((m) => m.tri === 'cacique')?.sources).toEqual(['A: T', 'B: U']);
    expect(fichier.mots.filter((m) => m.tri === 'cave')).toHaveLength(2);
    expect(rapport.doublonsFusionnes).toEqual(['Cacique']);
    expect(rapport.lignesRouges).toEqual(['Cave', 'Cave']);
  });

  it('garde tous les doublons qui ont une définition, et un seul quand aucun n’en a', () => {
    const { fichier, rapport } = importer([
      ligne({ mot: 'Ambages', tri: 'ambages', definition: 'Détours.' }),
      ligne({ mot: 'ambages', tri: 'ambages', definition: 'Circonlocutions.' }),
      ligne({ mot: 'Quitus', tri: 'quitus', genre: '###', source: 'A: T' }),
      ligne({ mot: 'Quitus ', tri: 'quitus', genre: '###', source: 'B: U\nA: T' }),
    ], options());
    expect(fichier.mots.filter((m) => m.tri === 'ambages')).toHaveLength(2);
    expect(fichier.mots.filter((m) => m.tri === 'quitus')).toEqual([expect.objectContaining({ sources: ['A: T', 'B: U'] })]);
    expect(rapport.doublonsGardes).toEqual(['Ambages']);
    expect(rapport.doublonsFusionnes).toEqual(['Quitus']);
  });

  it('reprend les identifiants d’un import précédent et trie selon Tri', () => {
    const premier = importer([ligne({ mot: "S'abolir", tri: 'abolir' }), ligne({ mot: 'Zèle', tri: 'zele' }), ligne({ mot: 'Écrin', tri: 'écrin' })], options()).fichier;
    const second = importer([ligne({ mot: 'Zèle', tri: 'zele' }), ligne({ mot: "S'abolir", tri: 'abolir' })], { ...options(), existant: premier }).fichier;
    expect(premier.mots.map((m) => m.mot)).toEqual(["S'abolir", 'Écrin', 'Zèle']);
    expect(second.mots.map((m) => m.id)).toEqual([premier.mots[0]!.id, premier.mots[2]!.id]);
  });

  it('compte les lignes et relève les mots à compléter avec texte et les genres inhabituels', () => {
    const { rapport } = importer([
      ligne({ mot: 'Ecluser', tri: 'ecluser', genre: '###', definition: '(biere)' }),
      ligne({ mot: 'Gabegie', tri: 'gabegie', genre: 'subst. C2223', definition: 'Désordre.' }),
      ligne({ mot: 'Accore', tri: 'accore', genre: 'adj. + subst. masc.', definition: 'Abrupt.' }),
    ], options());
    expect(rapport).toMatchObject({ lignes: 3, mots: 3, complets: 2, aCompleter: 1 });
    expect(rapport.aCompleterAvecTexte).toEqual(['Ecluser']);
    expect(rapport.genresInhabituels).toEqual(['Gabegie : subst. C2223']);
  });
});

it('met le rapport en Markdown', () => {
  const texte = rapportEnMarkdown({
    lignes: 4, mots: 3, complets: 1, aCompleter: 2,
    doublonsFusionnes: ['Cacique'], doublonsGardes: [], lignesRouges: ['Cave', 'Cave'],
    aCompleterAvecTexte: ['Ecluser'], genresInhabituels: ['Gabegie : subst. C2223'],
  });
  expect(texte).toContain('Lignes lues : 4');
  expect(texte).toContain('- Cacique');
  expect(texte).toContain('- Gabegie : subst. C2223');
  expect(texte).toContain('aucun');
});
