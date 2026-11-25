import { DEBUT_DE_SENS } from './definition';

/** Les abréviations de la saisie rapide, développées par Tab (sauf `n`, le numéro du sens suivant). */
export const ABREVIATIONS_SAISIE: Readonly<Record<string, string>> = Object.freeze({
  litt: '[Litt.] ',
  fig: '[Fig.] ',
  ext: '[Par ext.] ',
  anal: '[Par anal.] ',
  meto: '[Par méton.] ',
  meta: '[Par métaph.] ',
  vx: '[Vieux] ',
  vi: '[Vieilli] ',
  fam: '[Fam.] ',
  pej: '[Péj.] ',
  pop: '[Pop.] ',
  rare: '[Rare] ',
  ex: 'EX: ',
  syn: 'SYN: ',
  us: 'US: ',
  ant: 'ANTON: ',
});

export interface BoutonSaisie {
  texte: string; // ce que montre le bouton
  abreviation: string; // ce qu'on tape avant Tab
  principal: boolean; // visible sans « ⋯ »
}

function bouton(abreviation: string, principal: boolean): BoutonSaisie {
  const texte = abreviation === 'n' ? '1.' : (ABREVIATIONS_SAISIE[abreviation] ?? '').trimEnd();
  return Object.freeze({ texte, abreviation, principal });
}

/** Les boutons de la barre, dans l'ordre : les principaux d'abord, puis ceux que « ⋯ » déplie. */
export const BOUTONS_SAISIE: readonly BoutonSaisie[] = Object.freeze([
  ...['n', 'litt', 'fig', 'ext', 'vx', 'fam', 'ex', 'syn', 'us'].map((a) => bouton(a, true)),
  ...['anal', 'meto', 'meta', 'vi', 'pej', 'pop', 'rare', 'ant'].map((a) => bouton(a, false)),
]);

/** Le numéro du sens suivant : le plus grand numéro en tête de ligne, plus un ; 1 s'il n'y en a pas. */
export function numeroSuivant(avant: string): number {
  let plusGrand = 0;
  for (const ligne of avant.split(/\r?\n/)) {
    const m = DEBUT_DE_SENS.exec(ligne);
    if (m?.[1] !== undefined) plusGrand = Math.max(plusGrand, Number(m[1]));
  }
  return plusGrand + 1;
}

function enDebutDeLigne(avant: string): boolean {
  return avant === '' || avant.endsWith('\n');
}

/**
 * Le texte qu'insère un bouton au curseur, `avant` étant le texte jusqu'au curseur. Pour `n`, un retour
 * à la ligne (sauf en début de ligne) et le numéro du sens suivant.
 */
export function insertionPour(abreviation: string, avant: string): string {
  if (abreviation === 'n') return `${enDebutDeLigne(avant) ? '' : '\n'}${numeroSuivant(avant)}. `;
  return Object.hasOwn(ABREVIATIONS_SAISIE, abreviation) ? ABREVIATIONS_SAISIE[abreviation]! : '';
}

/** Le mot collé au curseur, précédé d'un début de texte, d'une espace ou d'un retour à la ligne. */
const MOT_AU_CURSEUR = /(?<=^|[ \n])\p{L}+$/u;

/**
 * Tab dans la définition : si le mot collé au curseur est une abréviation (majuscules ignorées), rend
 * combien de caractères retirer avant le curseur et quoi insérer ; sinon null. Pour `n`, les espaces
 * laissées en fin de ligne sont retirées avec l'abréviation.
 */
export function developper(avant: string): { longueur: number; insertion: string } | null {
  const mot = MOT_AU_CURSEUR.exec(avant)?.[0];
  if (mot === undefined) return null;
  const abreviation = mot.toLowerCase();
  const reste = avant.slice(0, avant.length - mot.length);
  if (abreviation === 'n') {
    const sansEspaces = reste.replace(/ +$/, '');
    return { longueur: avant.length - sansEspaces.length, insertion: insertionPour('n', sansEspaces) };
  }
  if (!Object.hasOwn(ABREVIATIONS_SAISIE, abreviation)) return null;
  return { longueur: mot.length, insertion: ABREVIATIONS_SAISIE[abreviation]! };
}
