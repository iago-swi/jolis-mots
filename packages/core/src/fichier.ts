import { normaliser } from './recherche';
import type { FichierMots, Mot } from './types';

/** Ordre du fichier : Tri sans accents ni majuscules, puis Mot. */
export function comparerMots(a: Mot, b: Mot): number {
  const cles = (m: Mot) => [normaliser(m.tri), normaliser(m.mot), m.mot];
  const ca = cles(a);
  const cb = cles(b);
  for (let i = 0; i < ca.length; i++) {
    if (ca[i]! < cb[i]!) return -1;
    if (ca[i]! > cb[i]!) return 1;
  }
  return 0;
}

/** JSON lisible dans l'historique : un mot par ligne, dans l'ordre de Tri. */
export function ecrireFichier(f: FichierMots): string {
  const mots = [...f.mots].sort(comparerMots).map((m) => '    ' + JSON.stringify(m));
  return [
    '{',
    `  "format": ${JSON.stringify(f.format)},`,
    `  "publie": ${JSON.stringify(f.publie)},`,
    mots.length === 0 ? '  "mots": []' : '  "mots": [\n' + mots.join(',\n') + '\n  ]',
    '}',
    '',
  ].join('\n');
}

const CHAINES = ['id', 'mot', 'tri', 'genre', 'definition', 'note', 'util'] as const;

function validerMot(x: unknown): Mot | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (!CHAINES.every((cle) => typeof o[cle] === 'string')) return null;
  if (!Array.isArray(o.sources) || !o.sources.every((s) => typeof s === 'string')) return null;
  if (typeof o.aCompleter !== 'boolean') return null;
  return {
    id: o.id as string,
    mot: o.mot as string,
    tri: o.tri as string,
    genre: o.genre as string,
    definition: o.definition as string,
    sources: [...(o.sources as string[])],
    note: o.note as string,
    util: o.util as string,
    aCompleter: o.aCompleter,
  };
}

/** Rend le fichier s'il a la bonne forme, sinon null (identifiant vide ou porté par deux mots compris). */
export function validerFichier(x: unknown): FichierMots | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (o.format !== 1 || typeof o.publie !== 'string' || !Array.isArray(o.mots)) return null;
  const mots: Mot[] = [];
  const ids = new Set<string>();
  for (const m of o.mots) {
    const mot = validerMot(m);
    if (mot === null || mot.id.trim() === '' || ids.has(mot.id)) return null;
    ids.add(mot.id);
    mots.push(mot);
  }
  return { format: 1, publie: o.publie, mots };
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Identifiant de 6 caractères parmi [a-z0-9]. */
export function creerId(): string {
  let id = '';
  while (id.length < 6) {
    const [octet] = crypto.getRandomValues(new Uint8Array(1));
    // 252 = 7 × 36 : au-delà, on retire pour garder chaque caractère équiprobable.
    if (octet !== undefined && octet < 252) id += ALPHABET[octet % 36];
  }
  return id;
}

/** Un identifiant absent de `pris` ; `tirer` donne les candidats (`creerId` par défaut). */
export function creerIdUnique(pris: Iterable<string>, tirer: () => string = creerId): string {
  const dejaPris = new Set(pris);
  let id = tirer();
  while (dejaPris.has(id)) id = tirer();
  return id;
}
