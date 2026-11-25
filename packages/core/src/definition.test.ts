import { describe, expect, it } from 'vitest';
import { developperIndication, indicationEstLongue, lireDefinition } from './definition';

const vide = { exemples: [], synonymes: [], antonymes: [], usages: [] };
const eployer = "Synon. littér. de déployer.\n1. [En parlant des ailes d'un oiseau] Étendre ce qui est replié. EX: Le vautour éploie ses ailes.\n2. S'étendre, s'ouvrir.";

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
  it("n'ouvre pas de sens numérotés si aucune ligne ne commence par 1.", () => {
    const brut = 'A. − Passer son temps à rêvasser.\n2. ... Pierre Brueghel avait fait le voyage.';
    expect(lireDefinition(brut)).toEqual([{ ...vide, numero: null, indication: null, texte: brut }]);
  });
  it('lit le texte placé avant le 1. comme un chapeau, sens sans numéro', () => {
    const sens = lireDefinition(eployer);
    expect(sens).toHaveLength(3);
    expect(sens[0]).toMatchObject({ numero: null, indication: null, texte: 'Synon. littér. de déployer.' });
    expect(sens[1]).toMatchObject({ numero: '1', indication: "En parlant des ailes d'un oiseau", texte: 'Étendre ce qui est replié.', exemples: ['Le vautour éploie ses ailes.'] });
    expect(sens[2]).toMatchObject({ numero: '2', texte: "S'étendre, s'ouvrir." });
  });
  it('garde le retour à la ligne d’un chapeau de deux lignes', () => {
    expect(lireDefinition('Ligne une.\nLigne deux.\n1. Sens.')[0]?.texte).toBe('Ligne une.\nLigne deux.');
  });
  it('laisse la ligne d’indication seule comme indication du premier sens, sans chapeau', () => {
    expect(lireDefinition('[Argot]\n1. Blesser.')).toHaveLength(1);
  });
  it('compte plus de 30 caractères pour une indication longue', () => {
    expect(indicationEstLongue('Litt., rare')).toBe(false);
    expect(indicationEstLongue('x'.repeat(30))).toBe(false);
    expect(indicationEstLongue("En parlant des ailes d'un oiseau ou p. compar. explicite")).toBe(true);
  });
  it('lit une ligne d’indication entre crochets avant 1. comme l’indication du premier sens', () => {
    const s = lireDefinition("[Usité seulement à l'inf.]\n1. Faire croire. EX: Il veut faire accroire.\n2. Mentir à quelqu'un.\n3. [Rare] Laisser croire.");
    expect(s).toHaveLength(3);
    expect(s[0]).toEqual({ ...vide, numero: '1', indication: "Usité seulement à l'inf.", texte: 'Faire croire.', exemples: ['Il veut faire accroire.'] });
    expect(s[1]).toMatchObject({ numero: '2', indication: null, texte: "Mentir à quelqu'un.", exemples: [] });
    expect(s[2]).toMatchObject({ numero: '3', indication: 'Rare', texte: 'Laisser croire.' });
  });
  it('garde la ligne entre crochets en tête du texte quand le premier sens a déjà son indication', () => {
    const s = lireDefinition('  [Argot]  \n\n1. [Fig.] Blesser, meurtrir.\n2. Abîmer.');
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ numero: '1', indication: 'Fig.', texte: '[Argot]\nBlesser, meurtrir.' });
    expect(s[1]).toMatchObject({ numero: '2', texte: 'Abîmer.' });
  });
  it('n’accepte qu’une seule ligne entre crochets avant 1.', () => {
    const s = lireDefinition('[Argot]\n[Vieilli]\n1. Blesser.\n2. Abîmer.');
    expect(s).toHaveLength(3);
    expect(s[0]).toEqual({ ...vide, numero: null, indication: 'Argot', texte: '[Vieilli]' });
    expect(s[1]).toMatchObject({ numero: '1', indication: null, texte: 'Blesser.' });
  });
  it('rend un tableau vide pour un texte vide', () => {
    expect(lireDefinition('  \n ')).toEqual([]);
  });
  it('ne perd aucun mot du texte', () => {
    const motsDe = (t: string) => t.replace(/\b(EX|SYN|US|ANTON|ANT) ?:/g, ' ').match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const brut of [
      '1. [Fig.] Endurci. EX: Le cœur calleux.\n\nligne isolée (biere)\n2. ex: minuscule SYN:dur, sec.',
      '[En tête seule]\n1. Endurci. EX: Le cœur calleux.\n2. [Rare] Sec.',
      '[En tête doublée]\n1. [Fig.] Endurci.\n2. Sec.',
      eployer,
    ]) {
      const sortie = lireDefinition(brut).map((s) => [s.numero, s.indication, s.texte, ...s.exemples, ...s.synonymes, ...s.antonymes, ...s.usages].join(' ')).join(' ');
      for (const m of motsDe(brut)) expect(sortie).toContain(m);
    }
  });
});

it('développe les indications connues et laisse les autres', () => {
  expect(developperIndication('Litt.')).toBe('Littéraire');
  expect(developperIndication('Fig., litt.')).toBe('Figuré, littéraire');
  expect(developperIndication("En parlant d'une côte")).toBe("En parlant d'une côte");
});
