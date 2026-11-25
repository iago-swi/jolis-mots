// Les mots d'une définition à soumettre au dictionnaire, et ceux qu'il ne connaît pas
// (conception, section 15.4). Le dictionnaire lui-même est hors du cœur : il est passé en
// fonction, qui rend `undefined` tant qu'elle n'a pas la réponse.

import { normaliser } from './recherche';
import type { Remarque } from './verification';

const FINE = ' ';

/** Un mot de la définition : entier, ses morceaux (composé ou élidé), et ce qui l'entoure. */
interface MotLu {
  forme: string;
  /** Les morceaux à demander si le mot entier est inconnu ; vide pour un mot simple. */
  morceaux: string[];
  /**
   * Une abréviation, si le dictionnaire ne connaît pas le mot : suivi d'un point, fini par une
   * consonne (« fam. », « partic. », « etc. »), et court (quatre lettres au plus) ou suivi d'autre
   * chose qu'une fin de phrase (« Synon. de », « littér. ou »). Un mot plus long qui finit une
   * phrase (« un ribleur. ») reste un mot.
   */
  abreviation: boolean;
}

/** Lettres, reliées par une apostrophe ou un trait d'union. */
const MOT = /\p{L}+(?:['’ʼ\-‑]\p{L}+)*/gu;
const APOSTROPHE = /['’ʼ]/u;
const VOYELLE_FINALE = /[aeiouyàâäéèêëîïôöùûüÿœæ]$/iu;
/** Les abréviations du CNRTL qui s'écrivent sans point : jamais signalées, quel que soit le dictionnaire. */
const ABREVIATIONS_SANS_POINT = new Set(['qqn', 'qqch', 'qqc', 'qqf', 'qqp']);
/** Ce qui peut séparer un début de phrase du mot qui l'ouvre. */
const OUVRANTS = new Set([' ', '\t', '\u00A0', '\u202F', '«', '“', '"', '(', '—', '–', '-']);

/** Ce qui peut suivre le point d'une fin de phrase avant la phrase suivante. */
const FERMANTS = new Set([' ', '\t', '\u00A0', '\u202F', ')', '»', '”', '"', ']']);

/** Vrai si le point en `i - 1` finit une phrase : suivi de la fin du texte, d'une ligne ou d'une majuscule. */
function finDePhrase(texte: string, i: number): boolean {
  for (let k = i; k < texte.length; k++) {
    const c = texte[k]!;
    if (c === '\n') return true;
    if (FERMANTS.has(c)) continue;
    return c === '«' || /\p{Lu}/u.test(c);
  }
  return true;
}

/** Vrai si le mot qui commence en `i` ouvre une phrase, une ligne ou une citation après « : ». */
function debutDePhrase(texte: string, i: number): boolean {
  for (let k = i - 1; k >= 0; k--) {
    const c = texte[k]!;
    if (c === '\n') return true;
    if (OUVRANTS.has(c)) continue;
    return /[.!?…:]/u.test(c);
  }
  return true;
}

const commenceParUneMajuscule = (mot: string) => /^\p{Lu}/u.test(mot);
const toutEnMajuscules = (mot: string) => mot === mot.toUpperCase() && mot !== mot.toLowerCase();

/** Cache des découpages : une définition est souvent relue sans avoir changé. */
const decoupages = new Map<string, MotLu[]>();
const DECOUPAGES_MAX = 5000;

/**
 * Les mots d'une définition qui se jugent au dictionnaire. Sont laissés de côté : ce qui est
 * entre crochets (les indications), les mots tout en majuscules (balises, sigles), les lettres
 * seules, et les noms propres (une majuscule hors début de phrase).
 */
function lire(definition: string): MotLu[] {
  const connu = decoupages.get(definition);
  if (connu !== undefined) return connu;
  const texte = definition.replace(/\[[^\]\n]*\]/gu, (m) => ' '.repeat(m.length));
  const mots: MotLu[] = [];
  for (const m of texte.matchAll(MOT)) {
    const forme = m[0];
    const debut = m.index ?? 0;
    if ([...forme].length < 2 || toutEnMajuscules(forme) || ABREVIATIONS_SANS_POINT.has(forme)) continue;
    const enTete = debutDePhrase(texte, debut);
    if (commenceParUneMajuscule(forme) && !enTete) continue;
    const morceaux: string[] = [];
    if (/['’ʼ\-‑]/u.test(forme)) {
      forme.split(/[\-‑]/u).forEach((piece, n) => {
        // Une élision (« l’ », « qu’ », « jusqu’ ») : seul ce qui la suit se juge.
        const net = APOSTROPHE.test(piece) ? piece.split(APOSTROPHE).slice(1).join('') : piece;
        const premier = n === 0 && !APOSTROPHE.test(piece);
        if ([...net].length < 2 || toutEnMajuscules(net)) return;
        // Un nom propre dans un composé (« d’Hypermnestre ») ne se juge pas.
        if (commenceParUneMajuscule(net) && !(premier && enTete)) return;
        morceaux.push(net);
      });
    }
    const apres = debut + forme.length;
    const abreviation =
      texte[apres] === '.' && !VOYELLE_FINALE.test(forme) && ([...forme].length <= 4 || !finDePhrase(texte, apres + 1));
    mots.push({ forme, morceaux, abreviation });
  }
  if (decoupages.size >= DECOUPAGES_MAX) decoupages.clear();
  decoupages.set(definition, mots);
  return mots;
}

/** Les mots à demander au dictionnaire pour cette définition : chaque mot entier et ses morceaux, une fois chacun. */
export function motsAVerifier(definition: string): string[] {
  const vus = new Set<string>();
  for (const m of lire(definition)) {
    vus.add(m.forme);
    for (const p of m.morceaux) vus.add(p);
  }
  return [...vus];
}

/**
 * Les mots de la définition inconnus du dictionnaire, dans l'ordre, une fois chacun.
 * `inconnu` rend vrai pour un mot inconnu, faux pour un mot connu, `undefined` sans réponse
 * encore : un tel mot n'est pas signalé. Un mot inconnu n'est pas signalé quand c'est une
 * abréviation (voir `MotLu.abreviation` : « fam. », « partic. », « etc. »),
 * ni quand c'est un composé dont tous les morceaux sont connus (« Crois-moi », « l’extrême-droite »),
 * ni quand c'est une forme du mot de la fiche, `vedette` (« sibile » pour Sibiler, « caristade »
 * pour Caristade) : un mot rare est d'ordinaire inconnu du dictionnaire.
 */
export function motsInconnus(definition: string, inconnu: (mot: string) => boolean | undefined, vedette = ''): string[] {
  const racines = racinesDe(vedette);
  const trouves = new Set<string>();
  for (const m of lire(definition)) {
    if (trouves.has(m.forme) || inconnu(m.forme) !== true) continue;
    if ([m.forme, ...m.morceaux].some((w) => racines.some((r) => normaliser(w).startsWith(r)))) continue;
    if (m.abreviation) continue;
    if (/['’ʼ\-‑]/u.test(m.forme) && !m.morceaux.some((p) => inconnu(p) === true)) continue;
    trouves.add(m.forme);
  }
  return [...trouves];
}

/**
 * Les racines des mots de la vedette (quatre lettres au moins), sans accents ni majuscules : le mot
 * sans ses deux dernières lettres, entre quatre et cinq lettres (« sibil » pour Sibiler, « lact »
 * pour Lacter, « aure » pour Aure).
 */
function racinesDe(vedette: string): string[] {
  return [...normaliser(vedette).matchAll(/\p{L}+/gu)]
    .map((m) => m[0])
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, Math.max(4, Math.min(5, w.length - 2))));
}

/** La remarque du vérificateur sur les mots inconnus ; null s'il n'y en a pas. Rien n'est corrigé. */
export function remarqueOrthographe(mots: readonly string[]): Remarque | null {
  if (mots.length === 0) return null;
  const pluriel = mots.length > 1;
  return {
    code: 'orthographe',
    texte: `Mot${pluriel ? 's' : ''} inconnu${pluriel ? 's' : ''} du dictionnaire${FINE}: ${mots.join(', ')}.`,
    correction: null,
    mots: [...mots],
  };
}
