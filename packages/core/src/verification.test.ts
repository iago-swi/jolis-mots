import { describe, expect, it } from 'vitest';
import type { Mot } from './types';
import { corrigerBalises, corrigerEspaces, indicationsConnues, verifierMot, type CodeRemarque } from './verification';

const NBSP = ' ';

function mot(partiel: Partial<Mot>): Mot {
  return { id: 'x', mot: 'Mot', tri: 'mot', genre: 'adj.', definition: 'Une définition.', sources: [], note: '', util: '', aCompleter: false, ...partiel };
}

// Mots de la vraie liste (donnees/mots.json), recopiés tels quels.
const acratopege = mot({ id: 'be974i', mot: 'Acratopège', genre: 'adj.', definition: '[Désuet, rare] Sans qualités particulières. EX : Ce musicien a une voix acratopège.' });
const guéer = mot({ id: 'xdolgp', mot: 'Guéer', genre: 'verbe trans.', definition: "Passer à gué (un cours d'eau) ." });
const escogriffe = mot({
  id: '1buj1r',
  mot: 'Escogriffe',
  genre: 'subst. masc.',
  definition: 'Homme de grande taille et dégingandé. SYN: asperge, géant, grand, grand échalas, grand escogriffe, voleur, échalas fam.), grande perche (fam.), perche (fam.).',
});
const amenite = mot({
  id: 'bfp1jk',
  mot: 'Aménité',
  genre: 'subst. fém.',
  definition:
    "1. [Litt., en parlant d'un site ou du climat] Qualité de ce qui est agréable à voir ou à sentir, douceur.\n2. Par ext., en parlant d'une personne ou de ses qualités morales, de son langage] Charme fait de douceur et de courtoisie.\n3. [Par antiphrase (au plur.)] Paroles déplaisantes, injures ou critiques. EX: échanger des aménités, se dire des aménités",
});
const serendipite = mot({ id: 'dm1cfq', mot: 'Sérendipité', genre: 'subst. fém.', definition: "[Néolog.]  Fait de trouver autre chose que ce que l'on cherchait. SYN: fortuité." });
const consomme = mot({
  id: 'rhitod',
  mot: 'Consommé',
  genre: 'adj.',
  definition:
    "1. [Litt, qualifie un subst. d'action] Qui est accompli, parfaitement achevé. EX: Il y a moins de discontinuité entre elle et Berthe qu'entre Guiscard et moi, du moins, ne se produit-il aucune rupture consommée définitive.\n2. [Qualifie une pers., une de ses qualités ou facultés, ou ce qui est créé par une pers.] Qui est parfait en son genre. EX: Sagesse, prudence consommée; science consommée.",
});
const decati =mot({ id: 'yg1p4a', mot: 'Décati', genre: 'adj.', definition: 'Vieilli. SYN: déjeté, fané, flétri, vieilli.' });
const genreInconnu = mot({ mot: 'Genre C2223', genre: 'subst. C2223', definition: 'Une définition.' });
// Béjaune : dans la vraie liste, il est encore « à compléter » ; voici la saisie décrite par Philippe, genre vide.
const bejaune = mot({ id: 'c4frkh', mot: 'Béjaune', genre: '', definition: '1. fauconnerie Oiseau jeune et niais.\n2. [Fig.] Jeune homme sot et sans expérience.' });

const AUTRES: Mot[] = [
  mot({ id: 'a', definition: '[Fig.] Un. [Par antiphrase (au plur.)] rien' }),
  mot({ id: 'b', definition: '1. [Vieux, fig.] Deux.\n2. [Rare] Trois.' }),
  mot({ id: 'c', definition: '[Vieux ou litt.] Quatre.' }),
];
const connues = indicationsConnues([...AUTRES, acratopege, amenite, serendipite]);

function codes(m: Mot): CodeRemarque[] {
  return verifierMot(m, connues).map((r) => r.code);
}

describe('indicationsConnues', () => {
  it('reprend la table des abréviations, développées ou non, en minuscules', () => {
    const c = indicationsConnues([]);
    for (const t of ['litt.', 'littéraire', 'fig.', 'figuré', 'par ext.', 'par extension', 'par méton.', 'iron.', 'ironique', 'vieux', 'vieilli', 'rare']) {
      expect(c.has(t), t).toBe(true);
    }
    expect(c.has('Fig.')).toBe(false);
  });
  it('ajoute les termes employés par au moins deux mots complets', () => {
    const c = indicationsConnues([
      mot({ id: '1', definition: '[Désuet] Un.' }),
      mot({ id: '2', definition: '1. [Désuet, néol.] Deux.' }),
      mot({ id: '3', definition: '[Néol.] Trois.', aCompleter: true }),
      mot({ id: '4', definition: '[Christianisme] Quatre. [Christianisme] Encore.' }),
    ]);
    expect(c.has('désuet')).toBe(true);
    expect(c.has('néol.')).toBe(false);
    expect(c.has('christianisme')).toBe(false);
  });
});

describe('verifierMot', () => {
  it('ne vérifie pas un mot à compléter', () => {
    expect(verifierMot({ ...bejaune, aCompleter: true }, connues)).toEqual([]);
    expect(verifierMot(mot({ genre: '', definition: '', aCompleter: true }), connues)).toEqual([]);
  });

  it('balise : EX avec une espace (Acratopège)', () => {
    const r = verifierMot(acratopege, connues).find((x) => x.code === 'balise');
    expect(r).toEqual({
      code: 'balise',
      texte: `Balise mal écrite${NBSP}: « EX : ».`,
      correction: '[Désuet, rare] Sans qualités particulières. EX: Ce musicien a une voix acratopège.',
    });
  });

  it('indication inconnue : une connue écrite autrement (Consommé : « Litt » sans point)', () => {
    expect(verifierMot(consomme, connues)).toEqual([{ code: 'indication-inconnue', texte: `Indication inconnue${NBSP}: [Litt].`, correction: null }]);
    const r = verifierMot(mot({ definition: '1. [vieilli.] Un.\n2. [Fgi., littér.] Deux.\n3. [Par métaph] Trois.' }), connues);
    expect(r).toEqual([{ code: 'indication-inconnue', texte: `Indications inconnues${NBSP}: [vieilli.], [Fgi.], [littér.], [Par métaph].`, correction: null }]);
  });

  it('indication connue : table, liste, termes combinés, nuances, notes', () => {
    expect(codes(mot({ definition: '1. [Vieux ou litt.] Un.\n2. [Fig., par ext.] Deux.\n3. [Par antiphrase (au plur.)] Trois.' }))).toEqual([]);
    expect(codes(mot({ definition: '1. [Désuet, rare] Un.\n2. [VIEUX et FIG.] Deux.' }))).toEqual([]);
    expect(codes(mot({ definition: '1. [Parfois péj.] Un.\n2. [Très fam.] Deux.\n3. [souvent par iron.] Trois.\n4. [Rare et au fig.] Quatre.' }))).toEqual([]);
    expect(codes(mot({ definition: "1. [En parlant d'une pers., de son humeur] Un.\n2. [En parlant d'un pays, d'une région] Deux.\n3. [Par ext., d'une pers.] Trois." }))).toEqual([]);
    expect(codes(amenite)).not.toContain('indication-inconnue');
  });

  it('indication nouvelle, employée une seule fois : pas de remarque (Sérendipité)', () => {
    expect(codes(serendipite)).not.toContain('indication-inconnue');
    expect(codes(mot({ definition: '1. [Phon.] Un.\n2. [Christianisme] Deux.\n3. [Myth. gr.] Trois.\n4. [Philosophie antique] Quatre.' }))).toEqual([]);
  });

  it('indication hors crochets : « fauconnerie Oiseau » (Béjaune) et « Par ext., » (Aménité)', () => {
    expect(verifierMot(bejaune, connues).filter((x) => x.code === 'indication-hors-crochets')).toEqual([
      { code: 'indication-hors-crochets', texte: `Indication hors crochets en tête du sens 1${NBSP}: « fauconnerie ».`, correction: null },
    ]);
    expect(verifierMot(amenite, connues).filter((x) => x.code === 'indication-hors-crochets')).toEqual([
      { code: 'indication-hors-crochets', texte: `Indication hors crochets en tête du sens 2${NBSP}: « Par ext. ».`, correction: null },
    ]);
  });

  it('indication hors crochets : les formes de la liste', () => {
    for (const debut of ['Sens figuré', 'Au fig.', 'Fig.', 'Par ext.', 'Litt.', 'Vieilli', 'Vieux']) {
      expect(codes(mot({ definition: `${debut}, se dit d'un oiseau.` })), debut).toEqual(['indication-hors-crochets']);
    }
    expect(verifierMot(mot({ definition: 'Vieux Homme âgé.' }), connues)[0]?.texte).toBe(`Indication hors crochets en tête de la définition${NBSP}: « Vieux ».`);
  });

  it('indication hors crochets : pas pour un vrai début de définition', () => {
    expect(codes(decati)).toEqual([]);
    expect(codes(mot({ definition: 'Vieux homme ridicule.' }))).toEqual([]);
    expect(codes(mot({ definition: 'Figure de style.' }))).toEqual([]);
    expect(codes(mot({ definition: 'qui est à Paris.' }))).toEqual([]);
    expect(codes(mot({ definition: '[Fig.] Litt. au sens propre.' }))).toEqual(['indication-hors-crochets']);
  });

  it('numérotation qui saute ou ne commence pas à 1', () => {
    const saute = bejaune.definition.replace('2.', '3.');
    expect(verifierMot(mot({ definition: saute }), connues).find((x) => x.code === 'numerotation')).toEqual({
      code: 'numerotation',
      texte: `Numérotation des sens à revoir${NBSP}: 1, 3.`,
      correction: null,
    });
    expect(codes(mot({ definition: 'Chapeau.\n2. Un.\n3. Deux.' }))).toEqual(['numerotation']);
    expect(codes(mot({ definition: '1. Un.\n2. Deux.\n2. Encore.' }))).toEqual(['numerotation']);
    expect(codes(mot({ definition: '1. Un.\n2. Deux, en 1900. 3. pas en tête.' }))).toEqual([]);
  });

  it('non fermé : parenthèse en trop (Escogriffe), crochet (Aménité)', () => {
    expect(verifierMot(escogriffe, connues)).toEqual([{ code: 'non-ferme', texte: `Signe ouvrant ou fermant sans pendant${NBSP}: ( ).`, correction: null }]);
    expect(verifierMot(amenite, connues).find((x) => x.code === 'non-ferme')?.texte).toBe(`Signe ouvrant ou fermant sans pendant${NBSP}: [ ].`);
    expect(verifierMot(mot({ definition: 'Un « mot. (Deux [trois' }), connues).find((x) => x.code === 'non-ferme')?.texte).toBe(
      `Signe ouvrant ou fermant sans pendant${NBSP}: [ ], ( ), « ».`,
    );
  });

  it('EX: vide', () => {
    const r = { code: 'exemple-vide', texte: 'Balise EX: sans exemple.', correction: null };
    expect(verifierMot(mot({ definition: 'Oiseau jeune. EX:' }), connues)).toEqual([r]);
    expect(verifierMot(mot({ definition: 'Oiseau jeune. EX: SYN: niais.' }), connues)).toEqual([r]);
    expect(verifierMot(mot({ definition: '1. Oiseau jeune. EX:\n2. Sot.' }), connues)).toEqual([r]);
    expect(codes(mot({ definition: '1. Oiseau jeune. EX: Un béjaune.\n2. Sot. EX:\nUn sot.' }))).toEqual([]);
  });

  it('genre vide (Béjaune) ou inconnu', () => {
    expect(verifierMot(bejaune, connues).find((x) => x.code === 'genre-vide')).toEqual({ code: 'genre-vide', texte: 'Genre vide.', correction: null });
    expect(verifierMot(genreInconnu, connues)).toEqual([{ code: 'genre-inconnu', texte: `Genre inconnu${NBSP}: « subst. C2223 ».`, correction: null }]);
    expect(codes(mot({ genre: 'adj + subst. masc.' }))).toEqual(['genre-inconnu']);
    expect(codes(mot({ genre: 'verbe défectif impers.' }))).toEqual([]);
  });

  it('espaces : avant un point (Guéer), doubles (Sérendipité)', () => {
    expect(verifierMot(guéer, connues)).toEqual([
      { code: 'espaces', texte: 'Espace double, ou espace avant un point ou une virgule.', correction: "Passer à gué (un cours d'eau)." },
    ]);
    expect(verifierMot(serendipite, connues).find((x) => x.code === 'espaces')?.correction).toBe("[Néolog.] Fait de trouver autre chose que ce que l'on cherchait. SYN: fortuité.");
  });

  it('remarques de Béjaune, dans l’ordre des codes', () => {
    expect(codes(bejaune)).toEqual(['indication-hors-crochets', 'genre-vide']);
  });

  it('un mot propre n’a aucune remarque', () => {
    expect(codes(mot({ definition: '1. [Fig.] Un. EX: Un exemple. SYN: un, deux.\n2. [Vieux ou litt.] Deux. ANT: trois. US: « Dire ... rien ».' }))).toEqual([]);
  });
});

/** Vrai si `apres` ne diffère de `avant` que dans les zones décrites par `motif` (dans `avant`), remplacées par `remplacer`. */
function seulementDans(avant: string, apres: string, motif: RegExp, remplacer: (zone: string) => string): void {
  let attendu = '';
  let i = 0;
  for (const m of avant.matchAll(motif)) {
    attendu += avant.slice(i, m.index) + remplacer(m[0]);
    i = (m.index ?? 0) + m[0].length;
  }
  attendu += avant.slice(i);
  expect(apres.length).toBe(attendu.length);
  for (let k = 0; k < apres.length; k++) expect(apres[k], `caractère ${k}`).toBe(attendu[k]);
}

describe('corrigerBalises', () => {
  const texte = 'Abc. Ex: un.\nSyn : deux, trois. EX : quatre. ex:cinq ANTON: six. ant : sept. us : huit. Index: neuf. texte: dix. EX: onze.';
  it('ramène les balises à leur forme canonique', () => {
    expect(corrigerBalises(texte)).toBe('Abc. EX: un.\nSYN: deux, trois. EX: quatre. EX:cinq ANTON: six. ANT: sept. US: huit. Index: neuf. texte: dix. EX: onze.');
  });
  it('ne change aucun autre caractère', () => {
    seulementDans(texte, corrigerBalises(texte), /(?<![\p{L}\p{N}])(?:ex|syn|us|anton|ant)[ \t  ]*:/giu, (z) => z.replace(/[ \t  ]/g, '').toUpperCase());
    expect(corrigerBalises(acratopege.definition).replace('EX:', 'EX :')).toBe(acratopege.definition);
    expect(corrigerBalises(amenite.definition)).toBe(amenite.definition);
  });
});

describe('corrigerEspaces', () => {
  const texte = "Passer à gué (un cours d'eau) .\n  2. Un  deux , trois   quatre.\nEX: ... « Amis ». Fin ...  ,x";
  it('réduit les espaces doubles et retire l’espace avant un point ou une virgule', () => {
    expect(corrigerEspaces(texte)).toBe("Passer à gué (un cours d'eau).\n  2. Un deux, trois quatre.\nEX: ... « Amis ». Fin ...,x");
  });
  it('ne touche ni aux retours à la ligne, ni aux retraits, ni aux points de suspension', () => {
    expect(corrigerEspaces('1. Un.\n\n  2. Deux ... trois.\n')).toBe('1. Un.\n\n  2. Deux ... trois.\n');
    expect(corrigerEspaces('Un  \nDeux')).toBe('Un  \nDeux');
  });
  it('ne change aucun autre caractère', () => {
    // Le texte corrigé s'obtient en retirant seulement des espaces U+0020 : tout autre caractère reste à sa place.
    const apres = corrigerEspaces(texte);
    let j = 0;
    for (let i = 0; i < texte.length; i++) {
      if (texte[i] === apres[j]) j++;
      else expect(texte[i], `caractère ${i}`).toBe(' ');
    }
    expect(j).toBe(apres.length);
    expect(texte.length - apres.length).toBe(7);
  });
});

describe('pureté', () => {
  it('ne modifie pas ce qu’on lui donne et rend toujours le même résultat', () => {
    const mots = [acratopege, amenite, bejaune].map((m) => Object.freeze({ ...m, sources: Object.freeze([...m.sources]) as string[] }));
    const c1 = indicationsConnues(mots);
    const c2 = indicationsConnues(mots);
    expect([...c1].sort()).toEqual([...c2].sort());
    for (const m of mots) expect(verifierMot(m, c1)).toEqual(verifierMot(m, c1));
    expect(c1).toEqual(c2);
  });
});

describe('point final', () => {
  function pointFinal(definition: string) {
    return verifierMot(mot({ definition }), connues).filter((r) => r.code === 'point-final');
  }
  /** La correction ne fait qu'ajouter des points : rien d'autre ne bouge. */
  function seulementDesPoints(avant: string, apres: string, ajoutes: number): void {
    let j = 0;
    for (let i = 0; i < avant.length; i++, j++) {
      while (apres[j] !== avant[i] && apres[j] === '.') j++;
      expect(apres[j], `caractère ${i}`).toBe(avant[i]);
    }
    expect(apres.length - avant.length).toBe(ajoutes);
  }

  it('un sens sans point', () => {
    expect(pointFinal('Oiseau jeune et niais')).toEqual([{ code: 'point-final', texte: 'Point final manquant', correction: 'Oiseau jeune et niais.' }]);
  });
  it('le sens 2 sur 3', () => {
    const def = '1. [Fig.] Un.\n2. Deux\n3. Trois.';
    expect(pointFinal(def)).toEqual([{ code: 'point-final', texte: 'Point final manquant (sens 2)', correction: '1. [Fig.] Un.\n2. Deux.\n3. Trois.' }]);
    expect(pointFinal('1. Un\n2. Deux.\n3. Trois')[0]?.texte).toBe('Point final manquant (sens 1, 3)');
  });
  it('texte suivi de EX: sur la même ligne', () => {
    expect(pointFinal('Oiseau jeune EX: Un béjaune.')[0]?.correction).toBe('Oiseau jeune. EX: Un béjaune.');
    expect(pointFinal('1. Oiseau jeune  EX : Un béjaune\n2. Sot. SYN: niais')[0]?.correction).toBe('1. Oiseau jeune.  EX : Un béjaune\n2. Sot. SYN: niais');
  });
  it('texte suivi d’un retour à la ligne puis SYN:', () => {
    const def = '1. Oiseau jeune \nSYN: niais.\n2. Sot.';
    expect(pointFinal(def)).toEqual([{ code: 'point-final', texte: 'Point final manquant (sens 1)', correction: '1. Oiseau jeune. \nSYN: niais.\n2. Sot.' }]);
  });
  it('parenthèse, guillemet, crochet fermants', () => {
    expect(pointFinal('Jeune homme (sot.)')).toEqual([]);
    expect(pointFinal('Jeune homme. (Rare.)')).toEqual([]);
    expect(pointFinal('Dit « niais ! »')).toEqual([]);
    expect(pointFinal('Jeune homme (rare)')[0]?.correction).toBe('Jeune homme (rare).');
  });
  it('accepte un guillemet droit après la ponctuation, et ignore une note finale entre crochets (Neume, Allitération)', () => {
    expect(pointFinal('Comme dans "Pour qui sont ces serpents qui sifflent sur vos têtes?"')).toEqual([]);
    expect(pointFinal('1. Un.\n2. Courte mélodie.\n[Note: le mot existe aussi au masculin]')).toEqual([]);
    expect(pointFinal('Chapeau:\n1. Un')[0]?.texte).toBe('Point final manquant (avant le sens 1, sens 1)');
  });
  it('accepte « ... », « … », « ! » et « ? »', () => {
    expect(pointFinal('1. Un...\n2. Deux…\n3. Trois !\n4. Quatre ?')).toEqual([]);
  });
  it('ignore un sens fait seulement de balises, et l’indication en tête', () => {
    expect(pointFinal('1. Un.\n2. EX: Un exemple sans point')).toEqual([]);
    expect(pointFinal('[Fig.]\n1. Un.\n2. Deux.')).toEqual([]);
    expect(pointFinal('1. [Fig.]')).toEqual([]);
    expect(pointFinal('Chapeau\n1. Un.')[0]?.texte).toBe('Point final manquant (avant le sens 1)');
  });
  it('la correction ne change aucun autre caractère', () => {
    const def = '[Litt.]\n1. Oiseau jeune  EX: Un béjaune\n\n2. [Fig.] Sot (rare)\t\nSYN: niais, sot\n3. Trois. US: rien\n4. Quatre';
    const [r] = pointFinal(def);
    expect(r?.texte).toBe('Point final manquant (sens 1, 2, 4)');
    seulementDesPoints(def, r!.correction!, 3);
    expect(r!.correction).toBe('[Litt.]\n1. Oiseau jeune.  EX: Un béjaune\n\n2. [Fig.] Sot (rare).\t\nSYN: niais, sot\n3. Trois. US: rien\n4. Quatre.');
  });
  it('un mot à compléter n’est pas concerné', () => {
    expect(verifierMot(mot({ definition: 'Sans point', aCompleter: true }), connues)).toEqual([]);
  });
});
