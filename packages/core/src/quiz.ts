import { lireDefinition } from './definition';
import { premierTerme } from './genre';
import { melanger } from './hasard';
import { motsARevoir } from './memoire';
import type { Progres } from './memoire';
import { normaliser } from './recherche';
import type { Mot } from './types';

export type Forme = 'definition-vers-mot' | 'mot-vers-definition';
export interface Choix {
  id: string;
  texte: string;
}
export interface Question {
  idMot: string;
  forme: Forme;
  enonce: string;
  genre: string;
  choix: Choix[];
  bonne: string;
}

/** Sur quels mots porte un quiz : tous les mots, ou ceux déjà vus et pas encore acquis. */
export type Portee = 'tous' | 'vus';
/** Nombres de questions proposés. */
export const QUESTIONS_POSSIBLES: readonly number[] = [5, 10, 15, 20];
export const QUESTIONS_PAR_DEFAUT = 10;
const MAUVAISES = 3;
const MASQUE = '—';

function echapper(texte: string): string {
  return [...texte].map((c) => ('\\^$.*+?()[]{}|'.includes(c) ? `\\${c}` : c)).join('');
}

/** Remplace chaque occurrence entière de `termes` (sans casse ni accents) par le masque ; le reste est conservé tel quel. */
function masquer(texte: string, termes: string[]): string {
  const cherches = [...new Set(termes.map(normaliser).filter((t) => t !== ''))].sort((a, b) => b.length - a.length);
  if (cherches.length === 0) return texte;

  // Forme normalisée, avec pour chaque caractère normalisé la position d'origine.
  let norm = '';
  const debuts: number[] = [];
  const fins: number[] = [];
  let i = 0;
  for (const c of texte) {
    const n = normaliser(c);
    for (let k = 0; k < n.length; k++) {
      debuts.push(i);
      fins.push(i + c.length);
    }
    norm += n;
    i += c.length;
  }

  const alternatives = cherches.map(echapper).join('|');
  const motif = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${alternatives})(?![\p{L}\p{N}])`, 'gu');
  let sortie = '';
  let curseur = 0;
  for (const m of norm.matchAll(motif)) {
    const debut = debuts[m.index] ?? 0;
    const fin = fins[m.index + m[0].length - 1] ?? texte.length;
    if (debut < curseur) continue;
    sortie += texte.slice(curseur, debut) + MASQUE;
    curseur = fin;
  }
  return sortie + texte.slice(curseur);
}

/**
 * Texte de définition présenté au quiz : le premier texte non vide (celui d'un sens numéroté, s'il en existe), mot masqué ;
 * à défaut, les synonymes du premier sens qui en a ; sinon une chaîne vide (le mot n'est alors pas interrogé).
 */
export function definitionPourQuiz(m: Mot): string {
  const sens = lireDefinition(m.definition);
  // Un chapeau (sens sans numéro) précède les sens numérotés : le quiz interroge sur le premier d'entre eux.
  const numerotes = sens.filter((s) => s.numero !== null);
  const avecTexte = numerotes.find((s) => s.texte !== '') ?? sens.find((s) => s.texte !== '');
  if (avecTexte) return masquer(avecTexte.texte, [m.mot, m.tri]);
  const avecSynonymes = sens.find((s) => s.synonymes.length > 0);
  if (avecSynonymes) return `Synonymes : ${avecSynonymes.synonymes.join(', ')}`;
  return '';
}

/**
 * Trois mauvaises réponses au plus. Jamais un synonyme déclaré du bon mot, ni un mot qui serait lui aussi
 * juste : même mot (un homographe), ou même texte de définition au quiz.
 */
function mauvaisesReponses(
  bonne: Mot,
  candidats: Mot[],
  alea: () => number,
  texte: (m: Mot) => string,
  definitionAuQuiz: (m: Mot) => string,
): Mot[] {
  const synonymes = new Set(lireDefinition(bonne.definition).flatMap((s) => s.synonymes).map(normaliser));
  const motBon = normaliser(bonne.mot);
  const definitionBonne = normaliser(definitionAuQuiz(bonne));
  const possibles = candidats.filter(
    (c) =>
      c.id !== bonne.id &&
      !synonymes.has(normaliser(c.mot)) &&
      !synonymes.has(normaliser(c.tri)) &&
      normaliser(c.mot) !== motBon &&
      normaliser(definitionAuQuiz(c)) !== definitionBonne,
  );
  const paliers = [
    possibles.filter((c) => c.genre === bonne.genre),
    possibles.filter((c) => premierTerme(c.genre) === premierTerme(bonne.genre)),
    possibles,
  ];
  const vus = new Set([normaliser(texte(bonne))]);
  const prises: Mot[] = [];
  for (const palier of paliers) {
    for (const c of melanger(palier, alea)) {
      if (prises.length === MAUVAISES) return prises;
      const t = normaliser(texte(c));
      if (vus.has(t)) continue;
      vus.add(t);
      prises.push(c);
    }
  }
  return prises;
}

/** Mots complets dont le texte au quiz n'est pas vide, avec ce texte calculé une seule fois. */
function interrogeablesDe(complets: Mot[]): { interrogeables: Mot[]; definitionAuQuiz: (m: Mot) => string } {
  const textes = new Map(complets.map((m) => [m, definitionPourQuiz(m)]));
  const definitionAuQuiz = (m: Mot) => textes.get(m) ?? definitionPourQuiz(m);
  return { interrogeables: complets.filter((m) => definitionAuQuiz(m) !== ''), definitionAuQuiz };
}

/** Nombre de mots que chaque portée permet d'interroger ; un progrès qui cite un mot absent de la liste est ignoré. */
export function compterPortees(complets: Mot[], progres: Progres): Record<Portee, number> {
  const { interrogeables } = interrogeablesDe(complets);
  const vus = interrogeables.filter((m) => Object.hasOwn(progres, m.id) && !progres[m.id]?.acquis).length;
  return { tous: interrogeables.length, vus };
}

/**
 * Compose les questions : les `nombre` premiers mots de la portée choisie pour lesquels une mauvaise réponse existe.
 * « tous » : les mots interrogeables, mélangés. « vus » : les mots à revoir (les dus d'abord), interrogeables.
 */
export function composerQuiz(a: {
  complets: Mot[];
  progres: Progres;
  portee: Portee;
  nombre: number;
  maintenant: Date;
  alea: () => number;
}): Question[] {
  const { interrogeables, definitionAuQuiz } = interrogeablesDe(a.complets);
  let aInterroger: Mot[];
  if (a.portee === 'tous') {
    aInterroger = melanger(interrogeables, a.alea);
  } else {
    const parId = new Map(interrogeables.map((m) => [m.id, m]));
    aInterroger = motsARevoir(a.progres, a.maintenant, a.alea)
      .map((id) => parId.get(id))
      .filter((m): m is Mot => m !== undefined);
  }

  const questions: Question[] = [];
  for (const m of aInterroger) {
    if (questions.length === a.nombre) break;
    const forme: Forme = questions.length % 2 === 0 ? 'definition-vers-mot' : 'mot-vers-definition';
    const texte = (c: Mot) => (forme === 'definition-vers-mot' ? c.mot : definitionAuQuiz(c));
    const mauvaises = mauvaisesReponses(m, interrogeables, a.alea, texte, definitionAuQuiz);
    if (mauvaises.length === 0) continue;
    const choix = melanger([m, ...mauvaises], a.alea).map((c) => ({ id: c.id, texte: texte(c) }));
    questions.push({
      idMot: m.id,
      forme,
      enonce: forme === 'definition-vers-mot' ? definitionAuQuiz(m) : m.mot,
      genre: m.genre,
      choix,
      bonne: m.id,
    });
  }
  return questions;
}
