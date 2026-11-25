import type { Mot } from './types';

/** Le champ d'un mot que vise une proposition de correction. */
export type ChampPropose = 'definition' | 'genre' | 'sources';

/**
 * Une proposition de correction, lue dans un fichier écrit après une relecture. `avant` est un passage
 * exact du champ (pour `sources`, d'une ligne de source ; pour `genre`, la valeur entière).
 */
export interface Proposition {
  id: string; // l'identifiant du mot
  mot: string;
  champ: ChampPropose;
  avant: string;
  apres: string;
  raison: string;
  certitude: 'forte' | 'faible';
}

const CHAMPS: readonly string[] = ['definition', 'genre', 'sources'];
const CERTITUDES: readonly string[] = ['forte', 'faible'];

function texte(v: unknown): v is string {
  return typeof v === 'string';
}

/** Une proposition contrôlée, ses seuls champs gardés ; null si elle est mal formée. */
export function lireProposition(e: unknown): Proposition | null {
  if (typeof e !== 'object' || e === null || Array.isArray(e)) return null;
  const { id, mot, champ, avant, apres, raison, certitude } = e as Record<string, unknown>;
  if (!texte(id) || id === '' || !texte(mot) || !texte(champ) || !CHAMPS.includes(champ)) return null;
  if (!texte(avant) || !texte(apres) || !texte(raison) || !texte(certitude) || !CERTITUDES.includes(certitude)) return null;
  // Un passage vide ne se retrouve pas ; une proposition qui ne change rien n'en est pas une.
  if ((avant === '' && champ !== 'genre') || avant === apres) return null;
  return { id, mot, champ: champ as ChampPropose, avant, apres, raison, certitude: certitude as Proposition['certitude'] };
}

/**
 * Les propositions d'un fichier `{ "format": 1, "propositions": [...] }` ; les entrées mal formées sont
 * écartées. Null si le texte ne se lit pas ou n'a pas cette forme.
 */
export function lirePropositions(contenu: string): Proposition[] | null {
  let donnees: unknown;
  try {
    donnees = JSON.parse(contenu);
  } catch {
    return null;
  }
  if (typeof donnees !== 'object' || donnees === null || Array.isArray(donnees)) return null;
  const { format, propositions } = donnees as Record<string, unknown>;
  if (format !== 1 || !Array.isArray(propositions)) return null;
  return propositions.map(lireProposition).filter((p): p is Proposition => p !== null);
}

/** Ce qui distingue une proposition d'une autre : le mot, le champ et le passage changé. */
export function cleProposition(p: Proposition): string {
  return JSON.stringify([p.id, p.champ, p.avant, p.apres]);
}

/** Les positions où figure `passage` dans `dans`, chevauchements compris. */
function positions(dans: string, passage: string): number[] {
  const trouvees: number[] = [];
  if (passage === '') return trouvees;
  for (let i = dans.indexOf(passage); i !== -1; i = dans.indexOf(passage, i + 1)) trouvees.push(i);
  return trouvees;
}

/**
 * Vrai quand la correction est déjà faite à cet endroit : `apres` contient `avant`, et le texte autour
 * du passage trouvé est déjà `apres`.
 */
function dejaCorrige(dans: string, i: number, p: Proposition): boolean {
  for (const k of positions(p.apres, p.avant)) if (i - k >= 0 && dans.slice(i - k, i - k + p.apres.length) === p.apres) return true;
  return false;
}

/** Le passage, dans le seul texte (ou la seule ligne) où il figure une fois ; null sinon. */
function emplacement(p: Proposition, m: Mot): { ligne: number; position: number } | null {
  const textes = p.champ === 'definition' ? [m.definition] : m.sources;
  const trouves = textes.flatMap((t, ligne) => positions(t, p.avant).map((position) => ({ ligne, position })));
  if (trouves.length !== 1) return null;
  const seul = trouves[0]!;
  return dejaCorrige(textes[seul.ligne]!, seul.position, p) ? null : seul;
}

/**
 * La proposition vaut pour ce mot tel qu'il est : son passage figure exactement une fois dans le champ
 * (pour le genre, le genre vaut le passage), et la correction n'y est pas déjà faite.
 */
export function appliquable(p: Proposition, m: Mot): boolean {
  if (p.id !== m.id) return false;
  if (p.champ === 'genre') return m.genre === p.avant;
  return emplacement(p, m) !== null;
}

/** Le mot, ce seul passage remplacé ; aucun autre caractère ne change. Tel quel si la proposition ne vaut pas. */
export function appliquer(p: Proposition, m: Mot): Mot {
  if (!appliquable(p, m)) return m;
  if (p.champ === 'genre') return { ...m, genre: p.apres };
  const { ligne, position } = emplacement(p, m)!;
  const remplacer = (t: string) => t.slice(0, position) + p.apres + t.slice(position + p.avant.length);
  if (p.champ === 'definition') return { ...m, definition: remplacer(m.definition) };
  return { ...m, sources: m.sources.map((s, i) => (i === ligne ? remplacer(s) : s)) };
}
