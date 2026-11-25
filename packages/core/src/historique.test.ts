import { describe, expect, it } from 'vitest';
import {
  HISTORIQUE_MAX,
  noterListe,
  referenceDe,
  validerHistorique,
  validerReference,
  type EntreeHistorique,
} from './historique';
import type { FichierMots, Mot } from './types';

function mot(id: string, nom: string, autres: Partial<Mot> = {}): Mot {
  return {
    id,
    mot: nom,
    tri: nom.toLowerCase(),
    genre: 'adj.',
    definition: `Définition de ${nom}.`,
    sources: ['Sylvain Tesson: Sur les chemins noirs (12)'],
    note: '',
    util: '',
    aCompleter: false,
    ...autres,
  };
}

function liste(publie: string, mots: Mot[]): FichierMots {
  return { format: 1, publie, mots };
}

const a = mot('a1', 'Abscons');
const b = mot('b1', 'Baguenauder');
const c = mot('c1', 'Cave');
const d = mot('d1', 'Débonder', { aCompleter: true });
const L1 = liste('2026-11-25T02:00:00Z', [a, b, c, d]);

describe('noterListe', () => {
  it('la première liste ouvre l’historique, sans liste de mots', () => {
    const r = noterListe([], null, L1);
    expect(r.historique).toEqual([
      { publie: L1.publie, debut: true, total: 3, ajoutes: [], modifies: [], supprimes: [] },
    ]);
    expect(r.reference).toEqual(referenceDe(L1));
  });

  it('une liste plus ancienne que la dernière notée ne note rien', () => {
    const r1 = noterListe([], null, L1);
    const r2 = noterListe(r1.historique, r1.reference, liste('2026-11-24T10:00:00Z', [a]));
    expect(r2.historique).toBe(r1.historique);
    expect(r2.reference).toBe(r1.reference);
  });

  it('une référence en retard sur l’historique ne fait pas de doublon', () => {
    const r1 = noterListe([], null, L1);
    const L2 = liste('2026-11-26T08:00:00Z', [a, b, c, { ...d, aCompleter: false }]);
    const r2 = noterListe(r1.historique, r1.reference, L2);
    // La référence de L2 n'a pas pu être gardée : on repart de celle de L1.
    const r3 = noterListe(r2.historique, r1.reference, L2);
    expect(r3.historique).toBe(r2.historique);
    expect(r3.reference.publie).toBe(L2.publie);
  });

  it('la même liste ne note rien', () => {
    const r1 = noterListe([], null, L1);
    const r2 = noterListe(r1.historique, r1.reference, L1);
    expect(r2.historique).toBe(r1.historique);
    expect(r2.reference).toBe(r1.reference);
  });

  it('une liste nouvelle note les ajouts, les modifications et les suppressions', () => {
    const r1 = noterListe([], null, L1);
    const L2 = liste('2026-11-25T02:44:23Z', [
      { ...a, definition: 'Difficile à comprendre.' }, // modifié
      b, // inchangé
      // c supprimé
      { ...d, aCompleter: false }, // devient complet : ajouté
      mot('e1', 'Éployer'), // nouveau : ajouté
    ]);
    const r2 = noterListe(r1.historique, r1.reference, L2);
    expect(r2.historique).toHaveLength(2);
    expect(r2.historique[1]).toEqual({
      publie: L2.publie,
      debut: false,
      total: 4,
      ajoutes: [
        { id: 'd1', mot: 'Débonder' },
        { id: 'e1', mot: 'Éployer' },
      ],
      modifies: [{ id: 'a1', mot: 'Abscons' }],
      supprimes: [{ id: 'c1', mot: 'Cave' }],
    });
    expect(r2.reference).toEqual(referenceDe(L2));
  });

  it('un mot recoché « à compléter » compte comme supprimé ; un renommage comme modifié', () => {
    const r1 = noterListe([], null, L1);
    const L2 = liste('2026-11-26T08:00:00Z', [{ ...a, mot: 'Abstrus' }, { ...b, aCompleter: true }, c, d]);
    const e = noterListe(r1.historique, r1.reference, L2).historique[1];
    expect(e?.modifies).toEqual([{ id: 'a1', mot: 'Abstrus' }]);
    expect(e?.supprimes).toEqual([{ id: 'b1', mot: 'Baguenauder' }]);
  });

  it('la note et l’utilisation ne comptent pas, ni un mot « à compléter » qui change', () => {
    const r1 = noterListe([], null, L1);
    const L2 = liste('2026-11-26T08:00:00Z', [{ ...a, note: '8', util: 'LL' }, b, c, { ...d, definition: 'Brouillon.' }]);
    const r2 = noterListe(r1.historique, r1.reference, L2);
    expect(r2.historique).toBe(r1.historique);
    expect(r2.reference.publie).toBe(L2.publie);
  });

  it('les sources et le genre comptent', () => {
    const r1 = noterListe([], null, L1);
    const L2 = liste('2026-11-26T08:00:00Z', [{ ...a, genre: 'adj. + subst.' }, { ...b, sources: [] }, c, d]);
    expect(noterListe(r1.historique, r1.reference, L2).historique[1]?.modifies.map((m) => m.id)).toEqual(['a1', 'b1']);
  });

  it('garde les entrées les plus récentes au-delà du maximum', () => {
    let h: EntreeHistorique[] = [];
    let ref = null;
    for (let i = 0; i <= HISTORIQUE_MAX + 5; i++) {
      const l = liste(new Date(Date.UTC(2026, 10, 25, 0, i)).toISOString(), [mot(`m${i}`, `Mot${i}`)]);
      ({ historique: h, reference: ref } = noterListe(h, ref, l));
    }
    expect(h).toHaveLength(HISTORIQUE_MAX);
    expect(h[h.length - 1]?.ajoutes).toEqual([{ id: `m${HISTORIQUE_MAX + 5}`, mot: `Mot${HISTORIQUE_MAX + 5}` }]);
  });

  it('ne modifie pas ses entrées', () => {
    const r1 = noterListe([], null, L1);
    const copie = JSON.parse(JSON.stringify(r1));
    noterListe(r1.historique, r1.reference, liste('2026-11-26T08:00:00Z', [a]));
    expect(r1).toEqual(copie);
  });
});

describe('validerHistorique et validerReference', () => {
  it('gardent ce qui a la bonne forme et écartent le reste', () => {
    const r = noterListe([], null, L1);
    expect(validerHistorique(JSON.parse(JSON.stringify(r.historique)))).toEqual(r.historique);
    expect(validerHistorique([{ publie: 'x' }, 5, null, ...r.historique])).toEqual(r.historique);
    expect(validerHistorique({})).toEqual([]);
    expect(validerReference(JSON.parse(JSON.stringify(r.reference)))).toEqual(r.reference);
    expect(validerReference({ publie: 3 })).toBeNull();
    expect(validerReference({ publie: 'pas une date', mots: {} })).toBeNull();
    expect(validerHistorique([...r.historique, ...r.historique])).toEqual(r.historique);
    expect(validerReference({ publie: 'x', mots: { a1: 'faux' } })).toBeNull();
    expect(validerReference(null)).toBeNull();
  });
});
