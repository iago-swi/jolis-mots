export interface Sens {
  numero: string | null; // "1", "2"… ou null
  indication: string | null; // contenu des crochets en tête de sens, sans les crochets
  texte: string;
  exemples: string[];
  synonymes: string[];
  antonymes: string[];
  usages: string[];
}

const BALISE = /(?<![\p{L}\p{N}])(EX|SYN|US|ANTON|ANT)[ \t]?:/gu;
const DEBUT_DE_SENS = /^\s*(\d+)\.(?!\d)/;

const ABREVIATIONS: Record<string, string> = {
  'litt.': 'Littéraire',
  'fig.': 'Figuré',
  'par ext.': 'Par extension',
  'par anal.': 'Par analogie',
  'par méton.': 'Par métonymie',
  'par métaph.': 'Par métaphore',
  'fam.': 'Familier',
  'péj.': 'Péjoratif',
  'pop.': 'Populaire',
  'vulg.': 'Vulgaire',
  'argot.': 'Argot',
  'poét.': 'Poétique',
  'iron.': 'Ironique',
};

/** Développe les abréviations d'une indication ; un terme inconnu reste tel quel. */
export function developperIndication(indication: string): string {
  return indication
    .split(',')
    .map((terme, i) => {
      const net = terme.trim();
      const developpe = ABREVIATIONS[net.toLowerCase()];
      if (developpe === undefined) return net;
      return i === 0 ? developpe : developpe.toLowerCase();
    })
    .join(', ');
}

function liste(segment: string): string[] {
  return segment
    .trim()
    .replace(/\.$/, '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m !== '');
}

function lireSens(numero: string | null, corps: string): Sens {
  let reste = corps.trimStart();
  let indication: string | null = null;
  if (reste.startsWith('[')) {
    const fin = reste.indexOf(']');
    if (fin !== -1) {
      indication = reste.slice(1, fin).trim() || null;
      reste = reste.slice(fin + 1);
    }
  }

  const sens: Sens = { numero, indication, texte: '', exemples: [], synonymes: [], antonymes: [], usages: [] };
  const balises = [...reste.matchAll(BALISE)];
  sens.texte = reste.slice(0, balises[0]?.index ?? reste.length).trim();

  balises.forEach((balise, i) => {
    const debut = (balise.index ?? 0) + balise[0].length;
    const fin = balises[i + 1]?.index ?? reste.length;
    const segment = reste.slice(debut, fin);
    switch (balise[1]) {
      case 'EX':
        if (segment.trim() !== '') sens.exemples.push(segment.trim());
        break;
      case 'US':
        if (segment.trim() !== '') sens.usages.push(segment.trim());
        break;
      case 'SYN':
        sens.synonymes.push(...liste(segment));
        break;
      default:
        sens.antonymes.push(...liste(segment));
    }
  });
  return sens;
}

/** Une ligne faite seulement d'une indication entre crochets, comme « [Argot] ». */
const LIGNE_INDICATION = /^\[[^\]]*[^\]\s][^\]]*\]$/;

/** Longueur au-delà de laquelle une indication est composée en italique courant. */
export const INDICATION_LONGUE = 30;

/** Une indication de plus de 30 caractères est lue comme une courte note, non comme une étiquette. */
export function indicationEstLongue(indication: string): boolean {
  return [...indication].length > INDICATION_LONGUE;
}

/**
 * Lit le texte brut d'une définition. Rien du texte n'est jamais écarté : hors conventions, il reste entier.
 * Une seule ligne d'indication entre crochets peut précéder le `1.` : elle devient l'indication du premier
 * sens, ou, s'il a déjà la sienne, reste en tête de son texte. Tout autre texte placé avant le `1.` forme
 * le chapeau, un premier sens sans numéro.
 */
export function lireDefinition(texte: string): Sens[] {
  if (texte.trim() === '') return [];
  let lignes = texte.split(/\r?\n/);
  const nonVides = lignes.filter((l) => l.trim() !== '');
  let entete: string | null = null;
  if (LIGNE_INDICATION.test(nonVides[0]?.trim() ?? '') && DEBUT_DE_SENS.exec(nonVides[1] ?? '')?.[1] === '1') {
    entete = nonVides[0]!.trim();
    lignes = lignes.slice(lignes.indexOf(nonVides[0]!) + 1);
  }
  const premier1 = lignes.findIndex((l) => DEBUT_DE_SENS.exec(l)?.[1] === '1');
  if (premier1 === -1) return [lireSens(null, texte)];
  const chapeau = lignes.slice(0, premier1).join('\n');
  lignes = lignes.slice(premier1);

  const sens: { numero: string; corps: string }[] = [];
  for (const ligne of lignes) {
    const m = DEBUT_DE_SENS.exec(ligne);
    const courant = sens[sens.length - 1];
    if (m?.[1] !== undefined) sens.push({ numero: m[1], corps: ligne.slice(m[0].length) });
    else if (courant) courant.corps += '\n' + ligne;
  }
  const lus = sens.map((s) => lireSens(s.numero, s.corps));
  const premier = lus[0];
  if (entete !== null && premier) {
    if (premier.indication === null) premier.indication = entete.slice(1, -1).trim();
    else premier.texte = premier.texte === '' ? entete : `${entete}\n${premier.texte}`;
  }
  return chapeau.trim() === '' ? lus : [lireSens(null, chapeau), ...lus];
}
