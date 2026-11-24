import { describe, expect, it } from 'vitest';
import { lireJson } from './stockage';

describe('lireJson', () => {
  it('rend la valeur par défaut quand le texte est absent ou illisible', () => {
    expect(lireJson(null, { a: 1 })).toEqual({ a: 1 });
    expect(lireJson('{"a":', { a: 1 })).toEqual({ a: 1 });
    expect(lireJson('{"a":2}', { a: 1 })).toEqual({ a: 2 });
  });

  it('rend la valeur par défaut quand le texte lisible n’a pas la forme attendue', () => {
    expect(lireJson('null', { a: 1 })).toEqual({ a: 1 });
    expect(lireJson('42', { a: 1 })).toEqual({ a: 1 });
    expect(lireJson('[1,2]', { a: 1 })).toEqual({ a: 1 });
    expect(lireJson('{"a":2}', [] as string[])).toEqual([]);
    expect(lireJson('["x"]', [] as string[])).toEqual(['x']);
  });
});
