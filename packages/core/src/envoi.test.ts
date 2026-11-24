import { describe, expect, it } from 'vitest';
import { compterModifications, dater, decrireModifications, messageDEnvoi, validerPourEnvoi } from './envoi';
import { ecrireFichier, validerFichier } from './fichier';
import type { FichierMots, Mot } from './types';

const mot = (id: string, nom: string, sources: string[] = ['Source 1']): Mot => ({ id, mot: nom, tri: nom.toLowerCase(), genre: 'nom', definition: `Définition de ${nom}`, sources, note: '', util: '', aCompleter: false });
const a = mot('aaaaaa', 'Alpha', ['Auteur: Titre (1)', 'Autre: Livre (2)']);
const b = mot('bbbbbb', 'Bravo');
const c = mot('cccccc', 'Charlie');
const liste = (mots: Mot[]): FichierMots => ({ format: 1, publie: '2026-11-24T10:00:00Z', mots });

describe('compterModifications', () => {
  it('ne compte rien quand seul l’ordre change', () => {
    expect(compterModifications([a, b], [b, a])).toEqual({ ajoutes: 0, modifies: 0, supprimes: 0, total: 0 });
  });
  it('compte ajouts et modifications', () => {
    expect(compterModifications([a, b], [{ ...a, note: '8' }, b, c])).toEqual({ ajoutes: 1, modifies: 1, supprimes: 0, total: 2 });
  });
  it('compte les suppressions', () => {
    expect(compterModifications([a, b], [a]).supprimes).toBe(1);
  });
  it('l’ordre des sources compte', () => {
    expect(compterModifications([a], [{ ...a, sources: [...a.sources].reverse() }]).modifies).toBe(1);
  });
  it('« à compléter » compte', () => {
    expect(compterModifications([a], [{ ...a, aCompleter: !a.aCompleter }]).modifies).toBe(1);
  });
  it('un mot remis comme avant ne compte pas', () => {
    expect(compterModifications([a], [{ ...{ ...a, genre: 'x' }, genre: a.genre }]).total).toBe(0);
  });
});

describe('messages', () => {
  const le24 = new Date(2026, 10, 24, 15, 30);
  it('décrit et date', () => {
    expect(messageDEnvoi({ ajoutes: 1, modifies: 3, supprimes: 0, total: 4 }, le24)).toBe('Liste du 24 novembre 2026 : 3 mots modifiés, 1 ajouté');
    expect(messageDEnvoi({ ajoutes: 0, modifies: 1, supprimes: 2, total: 3 }, le24)).toBe('Liste du 24 novembre 2026 : 1 mot modifié, 2 supprimés');
    expect(messageDEnvoi({ ajoutes: 0, modifies: 0, supprimes: 0, total: 0 }, le24)).toBe('Liste du 24 novembre 2026');
  });
  it('décrit au pluriel', () => {
    expect(decrireModifications({ ajoutes: 2, modifies: 0, supprimes: 0, total: 2 })).toBe('2 mots ajoutés');
    expect(decrireModifications({ ajoutes: 0, modifies: 0, supprimes: 0, total: 0 })).toBe('');
  });
});

describe('validerPourEnvoi', () => {
  it('signale les problèmes', () => {
    expect(validerPourEnvoi({ format: 1, publie: '', mots: [] })).toEqual(['La liste est vide.']);
    expect(validerPourEnvoi(liste([a, { ...b, id: a.id }]))).toEqual([`Deux mots portent le même identifiant (${a.id}).`]);
    expect(validerPourEnvoi(liste([{ ...a, id: '' }]))).toEqual(["Un mot n'a pas d'identifiant."]);
    expect(validerPourEnvoi(liste([{ ...a, mot: '  ' }]))).toEqual([`Un mot n'a pas de nom (identifiant ${a.id}).`]);
  });
  it('laisse partir une liste correcte', () => {
    expect(validerPourEnvoi(liste([a, b]))).toEqual([]);
  });
});

describe('dater', () => {
  it('met la date ISO sans millisecondes, sans muter', () => {
    const f = liste([a]);
    expect(dater(f, new Date('2026-11-24T14:53:21.789Z')).publie).toBe('2026-11-24T14:53:21Z');
    expect(f.publie).toBe('2026-11-24T10:00:00Z');
  });
});

it('le texte collé du CNRTL revient identique', () => {
  const colle = 'A.\u00a0−\u202fPasser\tson temps « à rêvasser » ; l’apostrophe, "guillemets", C:\\chemin\u2028suite 😀  \n\n';
  expect(colle).toContain('\\');
  const relu = validerFichier(JSON.parse(ecrireFichier(liste([{ ...a, definition: colle, sources: [' Auteur: Titre (1) '], note: ' 8 ' }]))));
  expect(relu?.mots[0]).toEqual({ ...a, definition: colle, sources: [' Auteur: Titre (1) '], note: ' 8 ' });
});
