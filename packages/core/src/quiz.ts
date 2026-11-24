import { lireDefinition } from './definition';
import { premierTerme } from './genre';
import { motsDus } from './memoire';
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

export const QUESTIONS_MAX = 10;
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
 * Texte de définition présenté au quiz : le premier texte non vide, mot masqué ;
 * à défaut, les synonymes du premier sens qui en a ; sinon une chaîne vide (le mot n'est alors pas interrogé).
 */
export function definitionPourQuiz(m: Mot): string {
  const sens = lireDefinition(m.definition);
  const avecTexte = sens.find((s) => s.texte !== '');
  if (avecTexte) return masquer(avecTexte.texte, [m.mot, m.tri]);
  const avecSynonymes = sens.find((s) => s.synonymes.length > 0);
  if (avecSynonymes) return `Synonymes : ${avecSynonymes.synonymes.join(', ')}`;
  return '';
}

function melanger<T>(liste: readonly T[], alea: () => number): T[] {
  const r = [...liste];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [r[i], r[j]] = [r[j] as T, r[i] as T];
  }
  return r;
}

function mauvaisesReponses(bonne: Mot, candidats: Mot[], alea: () => number): Mot[] {
  const synonymes = new Set(lireDefinition(bonne.definition).flatMap((s) => s.synonymes).map(normaliser));
  const possibles = candidats.filter(
    (c) => c.id !== bonne.id && !synonymes.has(normaliser(c.mot)) && !synonymes.has(normaliser(c.tri)),
  );
  const paliers = [
    possibles.filter((c) => c.genre === bonne.genre),
    possibles.filter((c) => premierTerme(c.genre) === premierTerme(bonne.genre)),
    possibles,
  ];
  const prises: Mot[] = [];
  for (const palier of paliers) {
    for (const c of melanger(palier, alea)) {
      if (prises.length === MAUVAISES) return prises;
      if (!prises.some((p) => p.id === c.id)) prises.push(c);
    }
  }
  return prises;
}

/** Compose les questions : mots de la séance d'abord, puis mots dus, dix au plus. */
export function composerQuiz(a: {
  complets: Mot[];
  seance: string[];
  progres: Progres;
  maintenant: Date;
  alea: () => number;
}): Question[] {
  const interrogeables = a.complets.filter((m) => definitionPourQuiz(m) !== '');
  const parId = new Map(interrogeables.map((m) => [m.id, m]));
  const ordre = [...new Set([...a.seance, ...motsDus(a.progres, a.maintenant)])];
  const aInterroger = ordre.map((id) => parId.get(id)).filter((m): m is Mot => m !== undefined);

  const questions: Question[] = [];
  for (const m of aInterroger) {
    if (questions.length === QUESTIONS_MAX) break;
    const mauvaises = mauvaisesReponses(m, interrogeables, a.alea);
    if (mauvaises.length === 0) continue;
    const forme: Forme = questions.length % 2 === 0 ? 'definition-vers-mot' : 'mot-vers-definition';
    const choix = melanger([m, ...mauvaises], a.alea).map((c) => ({
      id: c.id,
      texte: forme === 'definition-vers-mot' ? c.mot : definitionPourQuiz(c),
    }));
    questions.push({
      idMot: m.id,
      forme,
      enonce: forme === 'definition-vers-mot' ? definitionPourQuiz(m) : m.mot,
      genre: m.genre,
      choix,
      bonne: m.id,
    });
  }
  return questions;
}
