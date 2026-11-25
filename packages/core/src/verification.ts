import { ABREVIATIONS_INDICATION, DEBUT_DE_SENS, lireDefinition } from './definition';
import { genreEstConnu } from './genre';
import { ABREVIATIONS_SAISIE } from './saisie';
import { estComplet, type Mot } from './types';

export type CodeRemarque =
  | 'balise'
  | 'indication-inconnue'
  | 'indication-hors-crochets'
  | 'numerotation'
  | 'non-ferme'
  | 'exemple-vide'
  | 'genre-vide'
  | 'genre-inconnu'
  | 'espaces'
  | 'point-final';

/** Une remarque du vérificateur ; `correction` est la définition corrigée, ou null si rien n'est mécanique. */
export interface Remarque {
  code: CodeRemarque;
  texte: string;
  correction: string | null;
}

const FINE = ' ';

/** Une balise, bien ou mal écrite : casse quelconque, espaces avant les deux-points. */
const BALISE_LARGE = /(?<![\p{L}\p{N}])(ex|syn|us|anton|ant)[ \t  ]*:/giu;

/** Ramène `EX :`, `Ex:`, `ex:`, `Syn :`… à la forme canonique (`EX:`, `SYN:`…) ; rien d'autre ne change. */
export function corrigerBalises(texte: string): string {
  return texte.replace(BALISE_LARGE, (_, nom: string) => `${nom.toUpperCase()}:`);
}

/**
 * Réduit les espaces doubles à une et retire l'espace avant un point ou une virgule. Ne touche ni aux
 * retours à la ligne, ni aux retraits en début de ligne, ni aux espaces en fin de ligne, ni à l'espace
 * devant des points de suspension (« ... »).
 */
export function corrigerEspaces(texte: string): string {
  return texte.replace(/(?<=\S) +(?=,|\.(?!\.))/gu, '').replace(/(?<=\S) {2,}(?=\S)/gu, ' ');
}

/** Au-delà de cette longueur, un terme entre crochets est une note descriptive, non une étiquette. */
const TERME_LONG = 20;

/**
 * Une note descriptive plutôt qu'une étiquette : plus de 20 caractères, trois mots ou plus
 * (« En parlant d'un vin »), ou un complément qui commence par « d' », « de », « du », « des ».
 */
function estUneNote(terme: string): boolean {
  return [...terme].length > TERME_LONG || terme.split(/\s+/).length >= 3 || /^(?:d['’]|de |du |des )/u.test(terme);
}

/**
 * Les termes d'une indication à juger, tels qu'écrits : séparés par une virgule, un point-virgule,
 * « ou » ou « et ». Dès qu'un terme est une note (« En parlant d'une côte, d'un littoral »), la suite
 * de l'indication en fait partie : elle n'est ni découpée ni jugée.
 */
function termes(indication: string): string[] {
  const resultat: string[] = [];
  for (const partie of indication.split(/[,;]/)) {
    const net = partie.trim();
    if (estUneNote(net)) break;
    for (const t of net.split(/\s+(?:ou|et)\s+/u)) if (t.trim() !== '' && !estUneNote(t.trim())) resultat.push(t.trim());
  }
  return resultat;
}

/** Les mots qui nuancent une indication connue : « Parfois péj. », « Très fam. », « souvent par iron. ». */
const NUANCE = /^(?:parfois|souvent|surtout|gén\.|très|au|par)\s+/iu;

/** Vrai si le terme est connu, tel quel ou une fois ôtés les mots qui le nuancent. */
function estConnue(terme: string, connues: Set<string>): boolean {
  let t = terme.toLowerCase();
  for (;;) {
    if (connues.has(t)) return true;
    const reste = t.replace(NUANCE, '');
    if (reste === t) return false;
    t = reste;
  }
}

/** Forme de comparaison : minuscules, sans accents, sans points ni espaces. */
function squelette(terme: string): string {
  return terme
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ.\s]/gu, '');
}

/** Vrai si l'on passe de `a` à `b` en changeant, ajoutant, retirant ou intervertissant au plus un caractère. */
function presqueEgaux(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  const fin = (x: string, y: string) => x.slice(i + 1) === y.slice(i + 1) || x.slice(i + 1) === y.slice(i) || x.slice(i) === y.slice(i + 1);
  return fin(a, b) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}

/**
 * Un terme inconnu n'est signalé que s'il ressemble à une indication connue écrite autrement : même
 * squelette (« Litt », « vieilli. », « Par métaph »), abréviation ou développement d'une connue
 * (« littér. », « Médecine » à côté de « Méd. »), ou une faute de frappe (« Fgi. »). Une étiquette
 * nouvelle, employée une seule fois (« Phon. », « Christianisme »), n'est pas signalée.
 */
function ressembleAUneConnue(terme: string, connues: Set<string>): boolean {
  const s = squelette(terme);
  if (s.length < 3) return false;
  // Plusieurs mots (« Myth. gr. », « Philosophie antique ») : seulement s'ils réécrivent une connue.
  const unMot = !/\s/u.test(terme.trim());
  for (const connue of connues) {
    const c = squelette(connue);
    if (c.length < 3) continue;
    if (s === c) return true;
    if (unMot && (s.startsWith(c) || c.startsWith(s))) return true;
    if (unMot && presqueEgaux(s, c)) return true;
  }
  return false;
}

function indicationsDuMot(m: Mot): string[] {
  return lireDefinition(m.definition)
    .map((s) => s.indication)
    .filter((i): i is string => i !== null);
}

/**
 * Les indications connues, en minuscules : celles de la table (abrégées et développées), celles de la
 * barre de saisie, et tout terme employé par au moins deux mots complets.
 */
export function indicationsConnues(mots: Mot[]): Set<string> {
  const connues = new Set<string>();
  for (const [abrege, developpe] of Object.entries(ABREVIATIONS_INDICATION)) {
    connues.add(abrege.toLowerCase());
    connues.add(developpe.toLowerCase());
  }
  for (const insertion of Object.values(ABREVIATIONS_SAISIE)) {
    const m = /^\[(.*)\] $/.exec(insertion);
    if (m?.[1] !== undefined) connues.add(m[1].toLowerCase());
  }
  const emplois = new Map<string, number>();
  for (const m of mots) {
    if (!estComplet(m)) continue;
    const vus = new Set(indicationsDuMot(m).flatMap(termes).map((t) => t.toLowerCase()));
    for (const t of vus) emplois.set(t, (emplois.get(t) ?? 0) + 1);
  }
  for (const [t, n] of emplois) if (n >= 2) connues.add(t);
  return connues;
}

/** Les indications reconnues en tête de sens quand elles sont écrites sans crochets. */
const HORS_CROCHETS = /^(?:Sens figuré|Au fig\.|Fig\.|Par ext\.|Litt\.)/iu;
/** « Vieux » et « Vieilli » ouvrent aussi des définitions : seulement suivis d'une ponctuation ou d'une majuscule. */
const VIEUX = /^(?:Vieux|Vieilli)(?=[.,;]|\s+\p{Lu})/u;
/** Un mot tout en minuscules suivi d'un mot à majuscule : « fauconnerie Oiseau ». */
const MINUSCULE_MAJUSCULE = /^(\p{Ll}+)\s+\p{Lu}/u;

function horsCrochets(texte: string): string | null {
  const m = HORS_CROCHETS.exec(texte) ?? VIEUX.exec(texte);
  if (m) {
    // Seule, l'indication serait la définition elle-même (« Vieilli. » pour Décati).
    const suite = texte.slice(m[0].length).replace(/^[\s.,;]+/u, '');
    return suite === '' ? null : m[0];
  }
  return MINUSCULE_MAJUSCULE.exec(texte)?.[1] ?? null;
}

const PAIRES: [string, string][] = [
  ['[', ']'],
  ['(', ')'],
  ['«', '»'],
];

function compter(texte: string, signe: string): number {
  return texte.split(signe).length - 1;
}

/** Vrai quand une balise `EX:` n'est suivie d'aucun texte avant la balise suivante, le sens suivant ou la fin. */
function aUnExempleVide(texte: string): boolean {
  const balises = [...texte.matchAll(BALISE_LARGE)];
  return balises.some((b, i) => {
    if (b[1]?.toUpperCase() !== 'EX') return false;
    const debut = (b.index ?? 0) + b[0].length;
    let segment = texte.slice(debut, balises[i + 1]?.index ?? texte.length);
    const lignes = segment.split('\n');
    const sensSuivant = lignes.findIndex((l, k) => k > 0 && DEBUT_DE_SENS.test(l));
    if (sensSuivant !== -1) segment = lignes.slice(0, sensSuivant).join('\n');
    return segment.trim() === '';
  });
}

/** Une balise comme la lit `lireDefinition` : `EX:`, `SYN:`, `US:`, `ANTON:`, `ANT:`, une espace permise avant « : ». */
const BALISE_LUE = /(?<![\p{L}\p{N}])(?:EX|SYN|US|ANTON|ANT)[ \t]?:/u;
/** Une fin de phrase : « . », « ! », « ? » ou « … », suivis peut-être de « ) », « » », « ] » ou d'un guillemet droit ou anglais. */
const FIN_DE_PHRASE = /[.!?…](?:\s*[)»\]"”])*$/u;

/**
 * Les sens découpés comme par `lireDefinition`, avec, pour chacun, la position juste après le dernier
 * caractère de son texte propre (avant sa première balise), ou null si ce texte est vide.
 */
function finsDeSens(def: string): { numero: string | null; fin: number | null }[] {
  const lignes: { debut: number; numero: string | null; apresNumero: number }[] = [];
  let pos = 0;
  for (const ligne of def.split('\n')) {
    const m = DEBUT_DE_SENS.exec(ligne);
    lignes.push({ debut: pos, numero: m?.[1] ?? null, apresNumero: pos + (m?.[0].length ?? 0) });
    pos += ligne.length + 1;
  }
  const premier1 = lignes.findIndex((l) => l.numero === '1');
  const segments: { numero: string | null; debut: number; fin: number }[] = [];
  if (premier1 === -1) segments.push({ numero: null, debut: 0, fin: def.length });
  else {
    const numerotees = lignes.slice(premier1).filter((l) => l.numero !== null);
    segments.push({ numero: null, debut: 0, fin: lignes[premier1]!.debut });
    numerotees.forEach((l, i) => segments.push({ numero: l.numero, debut: l.apresNumero, fin: numerotees[i + 1]?.debut ?? def.length }));
  }
  return segments.map(({ numero, debut, fin }) => {
    let corps = def.slice(debut, fin);
    let decalage = debut;
    const blancs = corps.length - corps.trimStart().length;
    corps = corps.slice(blancs);
    decalage += blancs;
    if (corps.startsWith('[') && corps.includes(']')) {
      const apres = corps.indexOf(']') + 1;
      corps = corps.slice(apres);
      decalage += apres;
    }
    let texte = corps.slice(0, BALISE_LUE.exec(corps)?.index ?? corps.length).trimEnd();
    // Une dernière ligne faite d'une note entre crochets (« [Note: …] ») ne termine pas la phrase : on juge ce qui la précède.
    const derniere = texte.lastIndexOf('\n');
    if (derniere !== -1 && /^\[[^\]]*\]$/u.test(texte.slice(derniere + 1).trim())) texte = texte.slice(0, derniere).trimEnd();
    return { numero, fin: texte.trim() === '' ? null : decalage + texte.length };
  });
}

/** Les sens dont le texte propre ne finit pas par un point (ou « ! », « ? », « … »), et la définition corrigée. */
function pointsFinaux(def: string): { sens: (string | null)[]; correction: string } | null {
  const manquants = finsDeSens(def).filter((s): s is { numero: string | null; fin: number } => s.fin !== null && !FIN_DE_PHRASE.test(def.slice(0, s.fin)));
  if (manquants.length === 0) return null;
  let correction = def;
  for (const s of [...manquants].reverse()) correction = `${correction.slice(0, s.fin)}.${correction.slice(s.fin)}`;
  return { sens: manquants.map((s) => s.numero), correction };
}

/** Les remarques sur un mot complet, dans l'ordre des codes ; un mot à compléter (ou sans définition) n'en a aucune. */
export function verifierMot(m: Mot, connues: Set<string>): Remarque[] {
  if (!estComplet(m)) return [];
  const remarques: Remarque[] = [];
  const def = m.definition;
  const ajouter = (code: CodeRemarque, texte: string, correction: string | null = null) => remarques.push({ code, texte, correction });

  const balises = corrigerBalises(def);
  if (balises !== def) {
    const fautes = [...new Set([...def.matchAll(BALISE_LARGE)].map((b) => b[0]).filter((b) => b !== `${b.replace(/[^\p{L}]/gu, '').toUpperCase()}:`))];
    ajouter('balise', `Balise mal écrite${FINE}: ${fautes.map((f) => `« ${f} »`).join(', ')}.`, balises);
  }

  const sens = lireDefinition(def);
  const inconnues = [
    ...new Set(
      sens
        .map((s) => s.indication)
        .filter((i): i is string => i !== null)
        .flatMap(termes)
        .filter((t) => !estConnue(t, connues) && ressembleAUneConnue(t, connues)),
    ),
  ];
  if (inconnues.length > 0) {
    const pluriel = inconnues.length > 1;
    ajouter('indication-inconnue', `Indication${pluriel ? 's' : ''} inconnue${pluriel ? 's' : ''}${FINE}: ${inconnues.map((t) => `[${t}]`).join(', ')}.`);
  }

  for (const s of sens) {
    const trouve = horsCrochets(s.texte);
    if (trouve === null) continue;
    const ou = s.numero === null ? 'de la définition' : `du sens ${s.numero}`;
    ajouter('indication-hors-crochets', `Indication hors crochets en tête ${ou}${FINE}: « ${trouve} ».`);
    break;
  }

  const numeros = def.split(/\r?\n/).flatMap((l) => {
    const n = DEBUT_DE_SENS.exec(l)?.[1];
    return n === undefined ? [] : [Number(n)];
  });
  if (numeros.some((n, i) => n !== i + 1)) ajouter('numerotation', `Numérotation des sens à revoir${FINE}: ${numeros.join(', ')}.`);

  const desequilibres = PAIRES.filter(([o, f]) => compter(def, o) !== compter(def, f));
  if (desequilibres.length > 0) {
    ajouter('non-ferme', `Signe ouvrant ou fermant sans pendant${FINE}: ${desequilibres.map(([o, f]) => `${o} ${f}`).join(', ')}.`);
  }

  if (aUnExempleVide(def)) ajouter('exemple-vide', 'Balise EX: sans exemple.');

  if (m.genre.trim() === '') ajouter('genre-vide', 'Genre vide.');
  else if (!genreEstConnu(m.genre)) ajouter('genre-inconnu', `Genre inconnu${FINE}: « ${m.genre.trim()} ».`);

  const espaces = corrigerEspaces(def);
  if (espaces !== def) ajouter('espaces', 'Espace double, ou espace avant un point ou une virgule.', espaces);

  const points = pointsFinaux(def);
  if (points !== null) {
    const seul = points.sens.length === 1 && points.sens[0] === null && sens.length <= 1;
    const numeros = points.sens.filter((n) => n !== null);
    const lesquels = [...(points.sens.includes(null) ? ['avant le sens 1'] : []), ...(numeros.length > 0 ? [`sens ${numeros.join(', ')}`] : [])].join(', ');
    ajouter('point-final', seul ? 'Point final manquant' : `Point final manquant (${lesquels})`, points.correction);
  }

  return remarques;
}
