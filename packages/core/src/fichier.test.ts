import { expect, it } from 'vitest';
import { creerId, ecrireFichier, validerFichier } from './fichier';
import { importer, type LigneExcel } from './import';

const ligne = (p: Partial<LigneExcel>): LigneExcel => ({ mot: '', tri: '', genre: '', definition: '', note: '', util: '', source: '', rouge: false, ...p });
let n = 0;
const options = () => ({ publie: '2026-11-24T10:00:00Z', creerId: () => `id${++n}` });

it('écrit un mot par ligne et se relit à l’identique', () => {
  const { fichier } = importer([ligne({ mot: 'A', tri: 'a' }), ligne({ mot: 'B', tri: 'b' })], options());
  const texte = ecrireFichier(fichier);
  expect(texte.split('\n').filter((l) => l.includes('"id"'))).toHaveLength(2);
  expect(validerFichier(JSON.parse(texte))).toEqual(fichier);
});

it('écrit les mots dans l’ordre de Tri', () => {
  const { fichier } = importer([ligne({ mot: 'A', tri: 'a' }), ligne({ mot: 'B', tri: 'b' })], options());
  const texte = ecrireFichier({ ...fichier, mots: [...fichier.mots].reverse() });
  expect(texte.indexOf('"mot":"A"')).toBeLessThan(texte.indexOf('"mot":"B"'));
});

it.each([[null], ['<html>Not found</html>'], [{ format: 2, publie: '', mots: [] }], [{ format: 1, publie: '', mots: [{ id: 'a' }] }]])('refuse %j', (x) => expect(validerFichier(x)).toBeNull());

it('refuse un mot dont une propriété a le mauvais type', () => {
  const mot = { id: 'a', mot: 'A', tri: 'a', genre: '', definition: '', sources: ['x', 1], note: '', util: '', aCompleter: false };
  expect(validerFichier({ format: 1, publie: '', mots: [mot] })).toBeNull();
});

it('crée des identifiants de 6 caractères parmi [a-z0-9]', () => {
  for (let i = 0; i < 50; i++) expect(creerId()).toMatch(/^[a-z0-9]{6}$/);
});
