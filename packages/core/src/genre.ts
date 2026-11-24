const TERMES: Record<string, string> = {
  'adj.': 'adjectif',
  'subst.': 'nom',
  'masc.': 'masculin',
  'fém.': 'féminin',
  'plur.': 'pluriel',
  'inv.': 'invariable',
  'verbe': 'verbe',
  'trans.': 'transitif',
  'intrans.': 'intransitif',
  'pronom.': 'pronominal',
  'indir.': 'indirect',
  'impers.': 'impersonnel',
  'défectif': 'défectif',
  'adv.': 'adverbe',
  'expr.': 'expression',
  'interj.': 'interjection',
  'conj.': 'conjonction',
  'loc.': 'locution',
};

const CAS_ENTIERS: Record<string, string> = {
  'loc. adv.': 'locution adverbiale',
};

/** Développe un genre abrégé (« subst. masc. » devient « nom masculin »). */
export function developperGenre(genre: string): string {
  return genre
    .split(' + ')
    .map((partie) => {
      const p = partie.trim();
      if (CAS_ENTIERS[p]) return CAS_ENTIERS[p];
      return p
        .split(' ')
        .map((terme) => TERMES[terme] ?? terme)
        .join(' ');
    })
    .join(' et ');
}

/** Premier terme du genre : « adj. », « subst. », « verbe »… */
export function premierTerme(genre: string): string {
  return (genre.split(' + ')[0] ?? '').trim().split(' ')[0] ?? '';
}

/** Vrai quand chaque terme du genre figure dans la table de développement. */
export function genreEstConnu(genre: string): boolean {
  return genre
    .split(' + ')
    .flatMap((partie) => partie.trim().split(' '))
    .filter((terme) => terme !== '')
    .every((terme) => terme in TERMES);
}
