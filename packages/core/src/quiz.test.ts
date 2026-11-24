import { expect, it } from 'vitest';
import { composerQuiz, definitionPourQuiz, DUS_MAX } from './quiz';
import { marquerVu } from './memoire';
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

it('interroge la séance d’abord, puis les mots dus', () => {
  const [a, b, c] = complets as [Mot, Mot, Mot];
  const progres = marquerVu({}, b.id, new Date(Date.UTC(2026, 0, 1)));
  const qs = composerQuiz({ complets, seance: [c.id, a.id], progres, maintenant, alea: fabriqueAlea() });
  expect(qs.map((q) => q.idMot)).toEqual([c.id, a.id, b.id]);
});

it('limite les mots dus à DUS_MAX, soit cinq', () => {
  expect(DUS_MAX).toBe(5);
});

function motsNumerotes(n: number): Mot[] {
  return Array.from({ length: n }, (_, i) => mot(`Mot${String.fromCharCode(97 + i)}`, 'adj.', `Sens ${i}.`));
}
function dusDepuis(mots: Mot[]) {
  let p = {};
  for (const m of mots) p = marquerVu(p, m.id, new Date(Date.UTC(2026, 0, 1)));
  return p;
}

it('pose toute la séance, puis cinq mots dus au plus', () => {
  const tous = motsNumerotes(20);
  const seance = tous.slice(0, 7).map((m) => m.id);
  const progres = dusDepuis(tous.slice(7, 19));
  const qs = composerQuiz({ complets: tous, seance, progres, maintenant, alea: fabriqueAlea() });
  expect(qs).toHaveLength(12);
  expect(qs.slice(0, 7).map((q) => q.idMot)).toEqual(seance);
  const dus = qs.slice(7).map((q) => q.idMot);
  expect(new Set(dus).size).toBe(5);
  expect(dus.every((id) => !seance.includes(id))).toBe(true);
});

it('sans séance, pose cinq mots dus au plus', () => {
  const douze = motsNumerotes(12);
  const qs = composerQuiz({ complets: douze, seance: [], progres: dusDepuis(douze), maintenant, alea: fabriqueAlea() });
  expect(qs).toHaveLength(5);
  expect(new Set(qs.map((q) => q.idMot)).size).toBe(5);
});

it('ne compte pas deux fois un mot à la fois dans la séance et dû', () => {
  const [a, b, c] = motsNumerotes(3) as [Mot, Mot, Mot];
  const qs = composerQuiz({ complets: [a, b, c], seance: [a.id, b.id], progres: dusDepuis([a, c]), maintenant, alea: fabriqueAlea() });
  expect(qs.map((q) => q.idMot)).toEqual([a.id, b.id, c.id]);
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
    const [q] = composerQuiz({ complets: mots, seance: ['cible'], progres: {}, maintenant, alea: fabriqueAlea(graine) });
    const ids = q?.choix.map((c) => c.id) ?? [];
    expect(ids).toHaveLength(4);
    expect(ids).toContain('exact');
    expect(ids).toContain('proche');
  }
});

it('complète avec tous les mots quand le premier terme ne suffit pas', () => {
  const mots = [mot('Un', 'adj.', 'Premier.'), mot('Deux', 'adj.', 'Second.'), mot('Trois', 'verbe', 'Tiers.'), mot('Quatre', 'nom', 'Quart.')];
  const [q] = composerQuiz({ complets: mots, seance: ['un'], progres: {}, maintenant, alea: fabriqueAlea() });
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
    const [q] = composerQuiz({ complets: mots, seance: ['doublon-1'], progres: {}, maintenant, alea: fabriqueAlea(graine) });
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
    const [, q] = composerQuiz({ complets: mots, seance: ['premier', 'cible-1'], progres: {}, maintenant, alea: fabriqueAlea(graine) });
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
    const [, q] = composerQuiz({ complets: mots, seance: ['premier', 'doublon-1'], progres: {}, maintenant, alea: fabriqueAlea(graine) });
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
    const [q] = composerQuiz({ complets: mots, seance: ['cible-1'], progres: {}, maintenant, alea: fabriqueAlea(graine) });
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
