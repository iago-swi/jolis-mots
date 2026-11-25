import { describe, expect, it } from 'vitest';
import { appliquable, appliquer, cleProposition, lirePropositions, type Proposition } from './propositions';
import type { Mot } from './types';

function mot(extra: Partial<Mot> = {}): Mot {
  return {
    id: 'abs001',
    mot: 'Abstrus',
    tri: 'abstrus',
    genre: 'adj.',
    definition: '1. Difficile à comprendre.\n2. [Litt.] Se dit d’une œuvre litt. ou artistique ou savante. EX: Un texte abstrus.',
    sources: ['Marc Lévy: Le roman (12)', "Sylvain Tesson: L'Echappée belle. Eloge (40)"],
    note: 'XX',
    util: '',
    aCompleter: false,
    ...extra,
  };
}

function proposition(extra: Partial<Proposition> = {}): Proposition {
  return {
    id: 'abs001',
    mot: 'Abstrus',
    champ: 'definition',
    avant: 'litt. ou artistique ou',
    apres: 'litt. ou artistiques ou',
    raison: 'accord au pluriel',
    certitude: 'forte',
    ...extra,
  };
}

describe('lirePropositions', () => {
  it('lit un fichier bien formé', () => {
    const p = proposition();
    const texte = JSON.stringify({ format: 1, liste: '2026-11-25T03:49:19Z', propositions: [p, proposition({ champ: 'genre', avant: 'adj.', apres: 'adj. et subst.', certitude: 'faible' })] });
    expect(lirePropositions(texte)).toEqual([p, proposition({ champ: 'genre', avant: 'adj.', apres: 'adj. et subst.', certitude: 'faible' })]);
  });

  it('rend null pour un texte illisible ou d’une autre forme', () => {
    expect(lirePropositions('pas du JSON')).toBeNull();
    expect(lirePropositions('[]')).toBeNull();
    expect(lirePropositions(JSON.stringify({ format: 2, propositions: [] }))).toBeNull();
    expect(lirePropositions(JSON.stringify({ format: 1 }))).toBeNull();
  });

  it('écarte les entrées mal formées et garde les autres', () => {
    const bonne = proposition();
    const texte = JSON.stringify({
      format: 1,
      propositions: [
        bonne,
        null,
        'texte',
        { ...bonne, champ: 'note' },
        { ...bonne, certitude: 'moyenne' },
        { ...bonne, avant: 12 },
        { ...bonne, id: '' },
        { ...bonne, avant: '' },
        { ...bonne, apres: bonne.avant },
        { ...bonne, raison: undefined },
      ],
    });
    expect(lirePropositions(texte)).toEqual([bonne]);
  });

  it('ne garde que les champs connus', () => {
    const texte = JSON.stringify({ format: 1, propositions: [{ ...proposition(), autre: 'x' }] });
    expect(lirePropositions(texte)).toEqual([proposition()]);
  });
});

describe('appliquable', () => {
  it('vrai quand le passage figure exactement une fois', () => {
    expect(appliquable(proposition(), mot())).toBe(true);
  });

  it('faux pour un autre mot', () => {
    expect(appliquable(proposition({ id: 'autre1' }), mot())).toBe(false);
  });

  it('faux quand le passage est absent ou figure deux fois', () => {
    expect(appliquable(proposition({ avant: 'introuvable' }), mot())).toBe(false);
    expect(appliquable(proposition({ avant: 'ou ', apres: 'et ' }), mot())).toBe(false);
  });

  it('faux une fois corrigé, même quand la correction contient le passage', () => {
    const p = proposition();
    expect(appliquable(p, appliquer(p, mot()))).toBe(false);
    const allonge = proposition({ avant: 'Un texte', apres: 'Un texte abstrus, obscur. Un texte' });
    const corrige = appliquer(allonge, mot());
    expect(corrige.definition).toContain('Un texte abstrus, obscur. Un texte abstrus.');
    expect(appliquable(allonge, corrige)).toBe(false);
    // Le passage reste seul dans la correction : c'est elle qu'on retrouve, déjà faite.
    const ajout = proposition({ champ: 'sources', avant: 'Le roman', apres: 'Le roman noir' });
    expect(appliquable(ajout, mot())).toBe(true);
    expect(appliquable(ajout, appliquer(ajout, mot()))).toBe(false);
  });

  it('genre : vrai seulement quand le genre vaut le passage', () => {
    expect(appliquable(proposition({ champ: 'genre', avant: 'adj.', apres: 'adj. et subst.' }), mot())).toBe(true);
    expect(appliquable(proposition({ champ: 'genre', avant: 'adj', apres: 'adj. et subst.' }), mot())).toBe(false);
  });

  it('sources : le passage figure une fois en tout dans les lignes', () => {
    expect(appliquable(proposition({ champ: 'sources', avant: 'Marc Lévy', apres: 'Marc Levy' }), mot())).toBe(true);
    expect(appliquable(proposition({ champ: 'sources', avant: ': ', apres: ' : ' }), mot())).toBe(false);
    expect(appliquable(proposition({ champ: 'sources', avant: 'absent', apres: 'x' }), mot())).toBe(false);
  });
});

describe('appliquer', () => {
  it('définition : remplace ce seul passage, rien d’autre ne change', () => {
    const avant = mot();
    const apres = appliquer(proposition(), avant);
    expect(apres.definition).toBe(avant.definition.replace('litt. ou artistique ou', 'litt. ou artistiques ou'));
    expect({ ...apres, definition: avant.definition }).toEqual(avant);
    // Le mot donné reste tel quel.
    expect(avant).toEqual(mot());
  });

  it('genre : remplace la valeur entière', () => {
    const apres = appliquer(proposition({ champ: 'genre', avant: 'adj.', apres: 'adj. et subst.' }), mot());
    expect(apres).toEqual(mot({ genre: 'adj. et subst.' }));
  });

  it('sources : remplace le passage dans la ligne qui le contient', () => {
    const p = proposition({ champ: 'sources', avant: "L'Echappée belle. Eloge", apres: "L'Échappée belle. Éloge" });
    const apres = appliquer(p, mot());
    expect(apres).toEqual(mot({ sources: ['Marc Lévy: Le roman (12)', "Sylvain Tesson: L'Échappée belle. Éloge (40)"] }));
  });

  it('rend le mot tel quel quand la proposition n’est pas appliquable', () => {
    const m = mot();
    expect(appliquer(proposition({ avant: 'introuvable' }), m)).toEqual(m);
  });
});

describe('cleProposition', () => {
  it('distingue deux propositions du même mot', () => {
    const a = proposition();
    const b = proposition({ champ: 'genre', avant: 'adj.', apres: 'adj. et subst.' });
    expect(cleProposition(a)).not.toBe(cleProposition(b));
    expect(cleProposition(a)).toBe(cleProposition({ ...a, raison: 'autre raison' }));
  });
});
