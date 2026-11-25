import { describe, expect, it } from 'vitest';
import { ABREVIATIONS_SAISIE, BOUTONS_SAISIE, developper, insertionPour, numeroSuivant } from './saisie';

const TABLE: [string, string][] = [
  ['litt', '[Litt.] '],
  ['fig', '[Fig.] '],
  ['ext', '[Par ext.] '],
  ['anal', '[Par anal.] '],
  ['meto', '[Par méton.] '],
  ['meta', '[Par métaph.] '],
  ['vx', '[Vieux] '],
  ['vi', '[Vieilli] '],
  ['fam', '[Fam.] '],
  ['pej', '[Péj.] '],
  ['pop', '[Pop.] '],
  ['rare', '[Rare] '],
  ['ex', 'EX: '],
  ['syn', 'SYN: '],
  ['us', 'US: '],
  ['ant', 'ANTON: '],
];

describe('ABREVIATIONS_SAISIE', () => {
  it('reprend la table de la conception, sans n', () => {
    expect(Object.entries(ABREVIATIONS_SAISIE)).toEqual(TABLE);
  });
});

describe('BOUTONS_SAISIE', () => {
  it('met les boutons principaux en tête, dans l’ordre de la barre', () => {
    const principaux = BOUTONS_SAISIE.filter((b) => b.principal).map((b) => b.texte);
    expect(principaux).toEqual(['1.', '[Litt.]', '[Fig.]', '[Par ext.]', '[Vieux]', '[Fam.]', 'EX:', 'SYN:', 'US:']);
    expect(BOUTONS_SAISIE.slice(0, 9).every((b) => b.principal)).toBe(true);
  });
  it('a un bouton pour chaque abréviation, et n pour le numéro', () => {
    expect(BOUTONS_SAISIE.map((b) => b.abreviation).sort()).toEqual([...Object.keys(ABREVIATIONS_SAISIE), 'n'].sort());
    for (const b of BOUTONS_SAISIE) {
      if (b.abreviation !== 'n') expect(ABREVIATIONS_SAISIE[b.abreviation]).toBe(`${b.texte} `);
    }
  });
});

describe('developper', () => {
  it.each(TABLE)('développe %s', (abreviation, insertion) => {
    expect(developper(`Oiseau jeune. ${abreviation}`)).toEqual({ longueur: abreviation.length, insertion });
    expect(developper(abreviation)).toEqual({ longueur: abreviation.length, insertion });
    expect(developper(`1. Oiseau.\n${abreviation}`)).toEqual({ longueur: abreviation.length, insertion });
  });
  it('ne tient pas compte des majuscules', () => {
    expect(developper('Fig')).toEqual({ longueur: 3, insertion: '[Fig.] ' });
    expect(developper('texte EX')).toEqual({ longueur: 2, insertion: 'EX: ' });
    expect(developper('LiTt')).toEqual({ longueur: 4, insertion: '[Litt.] ' });
  });
  it('ne fait rien pour un mot qui n’est pas une abréviation', () => {
    expect(developper('exemple')).toBeNull();
    expect(developper('Un exemple')).toBeNull();
    expect(developper('')).toBeNull();
    expect(developper('Oiseau ')).toBeNull();
  });
  it('ne fait rien au milieu d’un mot', () => {
    expect(developper('texte')).toBeNull();
    expect(developper('Un texte')).toBeNull();
    expect(developper("l'ex")).toBeNull();
    expect(developper('(fig')).toBeNull();
    expect(developper('2ex')).toBeNull();
  });
  it('n après « 1. … » ouvre le sens 2 sur une nouvelle ligne', () => {
    expect(developper('1. Oiseau jeune. n')).toEqual({ longueur: 2, insertion: '\n2. ' });
    expect(developper('1. Oiseau jeune.n')).toBeNull();
    expect(developper('1. Oiseau jeune. N')).toEqual({ longueur: 2, insertion: '\n2. ' });
  });
  it('n en début de ligne donne le numéro seul', () => {
    expect(developper('1. Oiseau jeune.\nn')).toEqual({ longueur: 1, insertion: '2. ' });
    expect(developper('n')).toEqual({ longueur: 1, insertion: '1. ' });
  });
  it('n suit le plus grand numéro présent avant le curseur', () => {
    expect(developper('1. Un.\n3. Trois.\n2. Deux. n')).toEqual({ longueur: 2, insertion: '\n4. ' });
    expect(developper('Sans numéro. n')).toEqual({ longueur: 2, insertion: '\n1. ' });
  });
  it('retire les espaces laissées en fin de ligne avant un nouveau sens', () => {
    expect(developper('1. Oiseau jeune.   n')).toEqual({ longueur: 4, insertion: '\n2. ' });
  });
});

describe('numeroSuivant', () => {
  it('rend 1 sans numéro, sinon le plus grand plus un', () => {
    expect(numeroSuivant('')).toBe(1);
    expect(numeroSuivant('Oiseau jeune.')).toBe(1);
    expect(numeroSuivant('1. Un.\n2. Deux.')).toBe(3);
    expect(numeroSuivant('1. Un.\n  12. Douze.\n3. Trois.')).toBe(13);
  });
  it('ignore les nombres qui ne sont pas en tête de ligne', () => {
    expect(numeroSuivant('En 1900. Puis 3. et 4.')).toBe(1);
    expect(numeroSuivant('1.5 mètre')).toBe(1);
  });
});

describe('insertionPour', () => {
  it('rend le texte d’un bouton', () => {
    expect(insertionPour('litt', 'Oiseau ')).toBe('[Litt.] ');
    expect(insertionPour('syn', '')).toBe('SYN: ');
  });
  it('pour n, ouvre le sens suivant', () => {
    expect(insertionPour('n', '1. Oiseau.')).toBe('\n2. ');
    expect(insertionPour('n', '1. Oiseau.\n')).toBe('2. ');
    expect(insertionPour('n', '')).toBe('1. ');
  });
});

describe('pureté', () => {
  it('rend toujours le même résultat', () => {
    const avant = '1. Oiseau jeune. n';
    expect(developper(avant)).toEqual(developper(avant));
    expect(numeroSuivant(avant)).toBe(numeroSuivant(avant));
    expect(Object.isFrozen(ABREVIATIONS_SAISIE)).toBe(true);
    expect(Object.isFrozen(BOUTONS_SAISIE)).toBe(true);
  });
});
