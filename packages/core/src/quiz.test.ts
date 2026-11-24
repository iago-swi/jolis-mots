import { expect, it } from 'vitest';
import { composerQuiz, definitionPourQuiz, QUESTIONS_MAX } from './quiz';
import { marquerVu } from './memoire';
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

it('interroge la séance d’abord, puis les mots dus, dix au plus', () => {
  const [a, b, c] = complets as [Mot, Mot, Mot];
  const progres = marquerVu({}, b.id, new Date(Date.UTC(2026, 0, 1)));
  const qs = composerQuiz({ complets, seance: [c.id, a.id], progres, maintenant, alea: fabriqueAlea() });
  expect(qs.map((q) => q.idMot)).toEqual([c.id, a.id, b.id]);

  const douze = Array.from({ length: 12 }, (_, i) => mot(`Mot${String.fromCharCode(97 + i)}`, 'adj.', `Sens ${i}.`));
  let p = {};
  for (const m of douze) p = marquerVu(p, m.id, new Date(Date.UTC(2026, 0, 1)));
  const dix = composerQuiz({ complets: douze, seance: [], progres: p, maintenant, alea: fabriqueAlea() });
  expect(dix).toHaveLength(QUESTIONS_MAX);
  expect(new Set(dix.map((q) => q.idMot)).size).toBe(QUESTIONS_MAX);
});

it('alterne les formes et remplit énoncé, genre et choix selon la forme', () => {
  const ids = complets.slice(0, 3).map((m) => m.id);
  const [q0, q1] = composerQuiz({ complets, seance: ids, progres: {}, maintenant, alea: fabriqueAlea() });
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
  const [q] = composerQuiz({ complets, seance: [complets[0]!.id], progres: {}, maintenant, alea: fabriqueAlea() });
  expect(q?.choix).toHaveLength(4);
  expect(new Set(q?.choix.map((c) => c.id)).size).toBe(4);
  expect(q?.choix.some((c) => c.id === q.bonne)).toBe(true);
});

it('prend les mauvaises réponses dans le même genre quand il y en a assez', () => {
  const adjectifs = new Set(complets.slice(0, 5).map((m) => m.id));
  for (let graine = 1; graine <= 20; graine++) {
    const [q] = composerQuiz({ complets, seance: [complets[0]!.id], progres: {}, maintenant, alea: fabriqueAlea(graine) });
    expect(q?.choix.every((c) => adjectifs.has(c.id))).toBe(true);
  }
});

it('complète avec le même premier terme, puis avec tous les mots', () => {
  const mots = [
    mot('Un', 'adj. masc.', 'Un.'),
    mot('Deux', 'adj. fém.', 'Deux.'),
    mot('Trois', 'adj.', 'Trois.'),
    mot('Quatre', 'verbe', 'Quatre.'),
  ];
  const [q] = composerQuiz({ complets: mots, seance: ['un'], progres: {}, maintenant, alea: fabriqueAlea() });
  expect(q?.choix).toHaveLength(4);
  const un = mots.slice(0, 3).map((m) => m.id);
  // les deux autres adjectifs sont pris avant le verbe, mais comme il en faut trois, le verbe complète
  expect(un.every((id) => q?.choix.some((c) => c.id === id))).toBe(true);
  expect(q?.choix.some((c) => c.id === 'quatre')).toBe(true);
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
    const [q] = composerQuiz({ complets: mots, seance: ['baguenauder'], progres: {}, maintenant, alea: fabriqueAlea(graine) });
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
    const [q] = composerQuiz({ complets: mots, seance: ['baguenauder'], progres: {}, maintenant, alea: fabriqueAlea(graine) });
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
  const qs = composerQuiz({ complets: mots, seance: ['vide', 'aa'], progres: {}, maintenant, alea: fabriqueAlea() });
  expect(qs.map((q) => q.idMot)).toEqual(['aa']);
  expect(qs[0]?.choix.map((c) => c.id).sort()).toEqual(['aa', 'bb']);
});

it('se compose avec peu de mots et ignore les mots disparus', () => {
  expect(composerQuiz({ complets: complets.slice(0, 2), seance: [complets[0]!.id, 'disparu'], progres: {}, maintenant, alea: fabriqueAlea() })[0]?.choix).toHaveLength(2);
  expect(composerQuiz({ complets: complets.slice(0, 1), seance: [complets[0]!.id], progres: {}, maintenant, alea: fabriqueAlea() })).toEqual([]);
});

it('ne dépend que de alea', () => {
  const a = composerQuiz({ complets, seance: complets.map((m) => m.id), progres: {}, maintenant, alea: fabriqueAlea(7) });
  const b = composerQuiz({ complets, seance: complets.map((m) => m.id), progres: {}, maintenant, alea: fabriqueAlea(7) });
  expect(a).toEqual(b);
});
