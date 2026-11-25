import { expect, it } from 'vitest';
import { compterPortees, composerQuiz, definitionPourQuiz, QUESTIONS_PAR_DEFAUT, QUESTIONS_POSSIBLES } from './quiz';
import type { Progres } from './memoire';
import { normaliser } from './recherche';
import type { Mot } from './types';

function mot(nom: string, genre: string, definition: string, id = nom.toLowerCase()): Mot {
  return { id, mot: nom, tri: nom, genre, definition, sources: [], note: '', util: '', aCompleter: false };
}

/** Générateur déterministe (LCG) pour les tests. */
function fabriqueAlea(graine = 1): () => number {
  let s = graine;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const maintenant = new Date(Date.UTC(2026, 5, 1));
const genres = ['adj.', 'adj.', 'adj.', 'adj.', 'adj.', 'verbe', 'verbe', 'verbe', 'verbe', 'verbe'];
const noms = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];
const complets: Mot[] = noms.map((n, i) => mot(n, genres[i] ?? 'adj.', `Définition de ${n.toLowerCase()} numéro ${i}.`));

/** Date relative à 2026-11-24 (J(0)), en jours. */
const J = (n: number) => new Date(Date.UTC(2026, 10, 24 + n));

/** Progrès où les mots donnés sont dus dans l'ordre donné (tous passés par rapport à `maintenant`). */
function vus(ids: string[]) {
  const p: Progres = {};
  ids.forEach((id, i) => {
    const du = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    p[id] = { vu: du, case: 1, du, acquis: false };
  });
  return p;
}

function etatMot(du: Date, acquis = false): Progres[string] {
  return { vu: J(-10).toISOString(), case: 1, du: du.toISOString(), acquis };
}

// 12 mots interrogeables m1…m12 (définitions et textes distincts)
const douze: Mot[] = Array.from({ length: 12 }, (_, i) => mot(`Mot${String.fromCharCode(97 + i)}`, 'adj.', `Sens numéro ${i + 1}.`, `m${i + 1}`));
// progrès : m1 dû J(-2), m2 dû J(-1), m3 dû J(0), m4…m7 dus J(5), m8 acquis
const progresDouze: Progres = {
  m1: etatMot(J(-2)),
  m2: etatMot(J(-1)),
  m3: etatMot(J(0)),
  m4: etatMot(J(5)),
  m5: etatMot(J(5)),
  m6: etatMot(J(5)),
  m7: etatMot(J(5)),
  m8: etatMot(J(5), true),
};

it('portée « vus » : les dus d’abord, puis les autres mots vus mélangés, jamais un mot acquis', () => {
  const q = composerQuiz({ complets: douze, progres: progresDouze, portee: 'vus', nombre: 5, maintenant: J(0), alea: () => 0 });
  expect(q.map((x) => x.idMot).slice(0, 3)).toEqual(['m1', 'm2', 'm3']);
  expect(q).toHaveLength(5);
  expect(q.map((x) => x.idMot)).not.toContain('m8');
  expect(q.every((x) => ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'].includes(x.idMot))).toBe(true);
});

it('portée « tous » : jamais deux fois le même mot, au plus ce que la liste contient', () => {
  const tous = composerQuiz({ complets: douze.slice(0, 6), progres: {}, portee: 'tous', nombre: 10, maintenant: J(0), alea: Math.random });
  expect(new Set(tous.map((x) => x.idMot)).size).toBe(tous.length);
  expect(tous).toHaveLength(6);
});

it('portée « tous » : respecte le nombre demandé', () => {
  expect(composerQuiz({ complets: douze, progres: {}, portee: 'tous', nombre: 5, maintenant: J(0), alea: fabriqueAlea() })).toHaveLength(5);
});

it('rien de vu : pas de quiz sur les mots vus', () => {
  expect(composerQuiz({ complets: douze, progres: {}, portee: 'vus', nombre: 10, maintenant: J(0), alea: () => 0 })).toEqual([]);
});

it('compte les portées et ignore un progrès qui cite un mot disparu', () => {
  expect(compterPortees(douze, { ...progresDouze, fantome: progresDouze.m1! })).toEqual({ tous: 12, vus: 7 });
  expect(compterPortees(douze, {})).toEqual({ tous: 12, vus: 0 });
});

it('ne compte pas un mot sans définition utilisable', () => {
  const avecVide = [...douze.slice(0, 3), mot('Vide', 'adj.', 'EX: rien.', 'vide')];
  expect(compterPortees(avecVide, { ...vus(['m1', 'vide']) })).toEqual({ tous: 3, vus: 1 });
});

it('moins de quatre mots : le quiz se compose quand même, avec moins de choix', () => {
  const [q] = composerQuiz({ complets: douze.slice(0, 2), progres: {}, portee: 'tous', nombre: 5, maintenant: J(0), alea: () => 0 });
  expect(q?.choix).toHaveLength(2);
});

it('un seul mot : pas de question possible', () => {
  expect(composerQuiz({ complets: douze.slice(0, 1), progres: {}, portee: 'tous', nombre: 5, maintenant: J(0), alea: () => 0 })).toEqual([]);
});

it('propose 5, 10, 15 ou 20 questions, 10 par défaut', () => {
  expect(QUESTIONS_POSSIBLES).toEqual([5, 10, 15, 20]);
  expect(QUESTIONS_PAR_DEFAUT).toBe(10);
});

it('alterne les formes et remplit énoncé, genre et choix selon la forme', () => {
  const ids = complets.slice(0, 3).map((m) => m.id);
  const [q0, q1] = composerQuiz({ complets, portee: 'vus', nombre: 10, progres: vus(ids), maintenant, alea: fabriqueAlea() });
  const m0 = complets[0] as Mot;
  const m1 = complets[1] as Mot;
  expect(q0?.forme).toBe('definition-vers-mot');
  expect(q0?.enonce).toBe(definitionPourQuiz(m0));
  expect(q0?.genre).toBe(m0.genre);
  expect(q0?.choix.find((c) => c.id === q0.bonne)?.texte).toBe(m0.mot);
  expect(q1?.forme).toBe('mot-vers-definition');
  expect(q1?.enonce).toBe(m1.mot);
  expect(q1?.choix.find((c) => c.id === q1.bonne)?.texte).toBe(definitionPourQuiz(m1));
});

it('donne quatre choix distincts dont la bonne réponse', () => {
  const [q] = composerQuiz({ complets, portee: 'vus', nombre: 10, progres: vus([complets[0]!.id]), maintenant, alea: fabriqueAlea() });
  expect(q?.choix).toHaveLength(4);
  expect(new Set(q?.choix.map((c) => c.id)).size).toBe(4);
  expect(q?.choix.some((c) => c.id === q.bonne)).toBe(true);
});

it('prend les mauvaises réponses dans le même genre quand il y en a assez', () => {
  const adjectifs = new Set(complets.slice(0, 5).map((m) => m.id));
  for (let graine = 1; graine <= 20; graine++) {
    const [q] = composerQuiz({ complets, portee: 'vus', nombre: 10, progres: vus([complets[0]!.id]), maintenant, alea: fabriqueAlea(graine) });
    expect(q?.choix.every((c) => adjectifs.has(c.id))).toBe(true);
  }
});

it('prend d’abord le même genre exact, puis le même premier terme, puis les autres', () => {
  const mots = [
    mot('Cible', 'adj. masc.', 'Visé.'),
    mot('Exact', 'adj. masc.', 'Juste.'),
    mot('Proche', 'adj. fém.', 'Voisin.'),
    mot('Loin1', 'verbe', 'Loin un.'),
    mot('Loin2', 'verbe', 'Loin deux.'),
    mot('Loin3', 'nom', 'Loin trois.'),
  ];
  for (let graine = 1; graine <= 30; graine++) {
    const [q] = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['cible']), maintenant, alea: fabriqueAlea(graine) });
    const ids = q?.choix.map((c) => c.id) ?? [];
    expect(ids).toHaveLength(4);
    expect(ids).toContain('exact');
    expect(ids).toContain('proche');
  }
});

it('complète avec tous les mots quand le premier terme ne suffit pas', () => {
  const mots = [mot('Un', 'adj.', 'Premier.'), mot('Deux', 'adj.', 'Second.'), mot('Trois', 'verbe', 'Tiers.'), mot('Quatre', 'nom', 'Quart.')];
  const [q] = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['un']), maintenant, alea: fabriqueAlea() });
  expect(q?.choix.map((c) => c.id).sort()).toEqual(['deux', 'quatre', 'trois', 'un']);
});

it('ne montre jamais deux choix de même texte, dans la forme définition vers mot', () => {
  const mots = [
    mot('Doublon', 'adj.', 'Premier sens.', 'doublon-1'),
    mot('Doublon', 'adj.', 'Second sens.', 'doublon-2'),
    mot('Autre', 'adj.', 'Autre.'),
    mot('Encore', 'adj.', 'Encore.'),
    mot('Reste', 'adj.', 'Reste.'),
  ];
  for (let graine = 1; graine <= 30; graine++) {
    const [q] = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['doublon-1']), maintenant, alea: fabriqueAlea(graine) });
    expect(q?.forme).toBe('definition-vers-mot');
    const textes = q?.choix.map((c) => normaliser(c.texte)) ?? [];
    expect(new Set(textes).size).toBe(textes.length);
    expect(q?.choix).toHaveLength(4);
    expect(q?.choix.map((c) => c.id)).not.toContain('doublon-2');
  }
});

it('ne montre jamais deux choix de même texte, dans la forme mot vers définition', () => {
  const mots = [
    mot('Premier', 'adj.', 'Un sens.'),
    mot('Cible', 'adj.', 'Même définition.', 'cible-1'),
    mot('Jumeau', 'adj.', 'même définition.', 'cible-2'),
    mot('Autre', 'adj.', 'Un autre sens.'),
    mot('Encore', 'adj.', 'Encore un sens.'),
    mot('Reste', 'adj.', 'Le reste.'),
  ];
  for (let graine = 1; graine <= 30; graine++) {
    const [, q] = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['premier', 'cible-1']), maintenant, alea: fabriqueAlea(graine) });
    expect(q?.forme).toBe('mot-vers-definition');
    const textes = q?.choix.map((c) => normaliser(c.texte)) ?? [];
    expect(new Set(textes).size).toBe(textes.length);
    expect(q?.choix).toHaveLength(4);
    expect(q?.choix.map((c) => c.id)).not.toContain('cible-2');
  }
});

it('ne propose pas un homographe du mot demandé, dans la forme mot vers définition', () => {
  const mots = [
    mot('Premier', 'adj.', 'Un sens.'),
    mot('Doublon', 'adj.', 'Premier sens.', 'doublon-1'),
    mot('doublon', 'adj.', 'Second sens.', 'doublon-2'),
    mot('Autre', 'adj.', 'Un autre sens.'),
    mot('Encore', 'adj.', 'Encore un sens.'),
    mot('Reste', 'adj.', 'Le reste.'),
  ];
  for (let graine = 1; graine <= 30; graine++) {
    const [, q] = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['premier', 'doublon-1']), maintenant, alea: fabriqueAlea(graine) });
    expect(q?.forme).toBe('mot-vers-definition');
    expect(q?.choix).toHaveLength(4);
    expect(q?.choix.map((c) => c.id)).not.toContain('doublon-2');
  }
});

it('ne propose pas un mot de même définition au quiz, dans la forme définition vers mot', () => {
  const mots = [
    mot('Cible', 'adj.', 'Même définition.', 'cible-1'),
    mot('Autre', 'adj.', 'Un autre sens.'),
    mot('Encore', 'adj.', 'Encore un sens.'),
    mot('Reste', 'adj.', 'Le reste.'),
    mot('Jumeau', 'adj.', 'même définition.', 'cible-2'),
  ];
  for (let graine = 1; graine <= 30; graine++) {
    const [q] = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['cible-1']), maintenant, alea: fabriqueAlea(graine) });
    expect(q?.forme).toBe('definition-vers-mot');
    expect(q?.choix).toHaveLength(4);
    expect(q?.choix.map((c) => c.id)).not.toContain('cible-2');
  }
});

it('écarte les synonymes déclarés', () => {
  const mots = [
    mot('Baguenauder', 'verbe', 'Flâner. SYN: muser.'),
    mot('Muser', 'verbe', 'Perdre son temps.'),
    mot('Chiner', 'verbe', 'Chercher des occasions.'),
    mot('Gloser', 'verbe', 'Commenter.'),
    mot('Hanter', 'verbe', 'Fréquenter.'),
  ];
  for (let graine = 1; graine <= 50; graine++) {
    const [q] = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['baguenauder']), maintenant, alea: fabriqueAlea(graine) });
    expect(q?.choix.map((c) => c.id)).not.toContain('muser');
    expect(q?.choix).toHaveLength(4);
  }
});

it('écarte aussi les synonymes de tous les sens', () => {
  const mots = [
    mot('Baguenauder', 'verbe', '1. Flâner. SYN: muser.\n2. Rôder. SYN: chiner.'),
    mot('Muser', 'verbe', 'Perdre son temps.'),
    mot('Chiner', 'verbe', 'Chercher.'),
    mot('Gloser', 'verbe', 'Commenter.'),
    mot('Hanter', 'verbe', 'Fréquenter.'),
    mot('Rimer', 'verbe', 'Versifier.'),
  ];
  for (let graine = 1; graine <= 30; graine++) {
    const [q] = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['baguenauder']), maintenant, alea: fabriqueAlea(graine) });
    const ids = q?.choix.map((c) => c.id) ?? [];
    expect(ids).not.toContain('muser');
    expect(ids).not.toContain('chiner');
  }
});

it('masque le mot dans sa définition', () => {
  expect(definitionPourQuiz(mot('Abracadabrantesque', 'adj.', '[Néol.] Qui ressemble à ce qui est abracadabrantesque.'))).toBe('Qui ressemble à ce qui est —.');
});

it('masque le mot ou son tri sans tenir compte de la casse ni des accents, mais pas dans un mot plus long', () => {
  const m = { ...mot('Éphémère', 'adj.', 'Un éphemere sort, EPHÉMÈRE ou éphémères, comme l’éphémère.'), tri: 'ephemere' };
  expect(definitionPourQuiz(m)).toBe('Un — sort, — ou éphémères, comme l’—.');
});

it('garde tout le reste de la définition tel quel', () => {
  expect(definitionPourQuiz(mot('Cœur', 'subst.', 'Le cœur  bat — « fort » ; cœurs non.'))).toBe('Le —  bat — « fort » ; cœurs non.');
});

it('donne les synonymes quand la définition commence par une balise', () => {
  expect(definitionPourQuiz(mot('Paradoxe', 'subst.', "[Vieux] SYN: raisonnement par l'absurde."))).toBe("Synonymes : raisonnement par l'absurde");
  expect(definitionPourQuiz(mot('Cheftain', 'subst.', 'SYN: as, chef, gouvernant.'))).toBe('Synonymes : as, chef, gouvernant');
});

it('prend le texte du premier sens qui en a un, avant les synonymes', () => {
  expect(definitionPourQuiz(mot('Xyz', 'subst.', '1. SYN: as.\n2. Une chose.'))).toBe('Une chose.');
});

it('interroge sur le premier sens numéroté quand un chapeau le précède', () => {
  const eployer = "Synon. littér. de déployer.\n1. [En parlant des ailes d'un oiseau] Étendre ce qui est replié. EX: Le vautour éploie ses ailes.\n2. S'étendre, s'ouvrir.";
  expect(definitionPourQuiz({ ...mot('Éployer', 'verbe', eployer), tri: 'éployer' })).toBe('Étendre ce qui est replié.');
});

it('rend une chaîne vide sans texte ni synonymes', () => {
  expect(definitionPourQuiz(mot('Xyz', 'subst.', 'EX: un exemple.'))).toBe('');
  expect(definitionPourQuiz(mot('Xyz', 'subst.', ''))).toBe('');
});

it('n’interroge ni ne propose un mot sans définition utilisable', () => {
  const mots = [
    mot('Aa', 'adj.', 'Premier.'),
    mot('Bb', 'adj.', 'Second.'),
    mot('Vide', 'adj.', 'EX: rien.'),
  ];
  const qs = composerQuiz({ complets: mots, portee: 'vus', nombre: 10, progres: vus(['vide', 'aa']), maintenant, alea: fabriqueAlea() });
  expect(qs.map((q) => q.idMot)).toEqual(['aa']);
  expect(qs[0]?.choix.map((c) => c.id).sort()).toEqual(['aa', 'bb']);
});

it('ne dépend que de alea', () => {
  const a = composerQuiz({ complets, portee: 'tous', nombre: 10, progres: {}, maintenant, alea: fabriqueAlea(7) });
  const b = composerQuiz({ complets, portee: 'tous', nombre: 10, progres: {}, maintenant, alea: fabriqueAlea(7) });
  expect(a).toEqual(b);
});
