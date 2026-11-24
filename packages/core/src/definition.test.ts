import { describe, expect, it } from 'vitest';
import { developperIndication, lireDefinition } from './definition';

const vide = { exemples: [], synonymes: [], antonymes: [], usages: [] };

describe('lireDefinition', () => {
  it('lit un sens unique avec son exemple', () => {
    expect(lireDefinition("Cesser d'être, d'exister. EX: Ton saint nom s'abolir.")).toEqual([
      { ...vide, numero: null, indication: null, texte: "Cesser d'être, d'exister.", exemples: ["Ton saint nom s'abolir."] },
    ]);
  });
  it('lit des sens numérotés, une indication et des synonymes', () => {
    const s = lireDefinition('1. Passer son temps à des choses frivoles. SYN: muser.\n2. [Par ext.] Se promener sans but précis, flâner. EX: Le Bouvron baguenaudant.');
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ numero: '1', indication: null, texte: 'Passer son temps à des choses frivoles.', synonymes: ['muser'] });
    expect(s[1]).toMatchObject({ numero: '2', indication: 'Par ext.', texte: 'Se promener sans but précis, flâner.', exemples: ['Le Bouvron baguenaudant.'] });
  });
  it('accepte une espace avant les deux-points et sépare les synonymes', () => {
    const [s] = lireDefinition('Mener une vie paresseuse. SYN: cagnarder, fainéanter. EX : Ils s’acagnardent dans leur lit.');
    expect(s?.synonymes).toEqual(['cagnarder', 'fainéanter']);
    expect(s?.exemples).toEqual(['Ils s’acagnardent dans leur lit.']);
  });
  it('lit US, ANT et ANTON', () => {
    const [s] = lireDefinition('Sans détours. US: Parler sans ambages. ANTON: détour. ANT: ambages.');
    expect(s).toMatchObject({ usages: ['Parler sans ambages.'], antonymes: ['détour', 'ambages'] });
  });
  it('laisse dans le texte les crochets qui ne sont pas en tête', () => {
    const [s] = lireDefinition("Baquet tenant lieu de fosse d'aisances. [Par méton., gén. au plur.] Lieux d'aisances.");
    expect(s).toMatchObject({ indication: null, texte: "Baquet tenant lieu de fosse d'aisances. [Par méton., gén. au plur.] Lieux d'aisances." });
  });
  it("n'ouvre pas de sens numérotés si le texte ne commence pas par 1.", () => {
    const brut = 'A. − Passer son temps à rêvasser.\n1. ... Pierre Brueghel avait fait le voyage.';
    expect(lireDefinition(brut)).toEqual([{ ...vide, numero: null, indication: null, texte: brut }]);
  });
  it('rend un tableau vide pour un texte vide', () => {
    expect(lireDefinition('  \n ')).toEqual([]);
  });
  it('ne perd aucun mot du texte', () => {
    const brut = '1. [Fig.] Endurci. EX: Le cœur calleux.\n\nligne isolée (biere)\n2. ex: minuscule SYN:dur, sec.';
    const motsDe = (t: string) => t.replace(/\b(EX|SYN|US|ANTON|ANT) ?:/g, ' ').match(/[\p{L}\p{N}]+/gu) ?? [];
    const sortie = lireDefinition(brut).map((s) => [s.numero, s.indication, s.texte, ...s.exemples, ...s.synonymes, ...s.antonymes, ...s.usages].join(' ')).join(' ');
    for (const m of motsDe(brut)) expect(sortie).toContain(m);
  });
});

it('développe les indications connues et laisse les autres', () => {
  expect(developperIndication('Litt.')).toBe('Littéraire');
  expect(developperIndication('Fig., litt.')).toBe('Figuré, littéraire');
  expect(developperIndication("En parlant d'une côte")).toBe("En parlant d'une côte");
});
