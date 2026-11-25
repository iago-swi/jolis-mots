import { afterAll, describe, expect, it } from 'vitest';
import { creerCorrecteur } from './orthographe';

// Le vrai correcteur de Windows, par PowerShell : ces essais ne tournent que sous Windows.
const DELAI = 60_000;

describe.runIf(process.platform === 'win32')('le correcteur de Windows', () => {
  const correcteur = creerCorrecteur();
  afterAll(() => correcteur.fermer());

  it('rend les mots inconnus, accents compris, et rien pour une liste vide', { timeout: DELAI }, async () => {
    expect(await correcteur.inconnus([])).toEqual([]);
    const mots = ['maison', 'fautte', 'éployer', 'aujourd’hui', 'xyzzyq', 'cœur', 'bouffonerie', 'naïf'];
    expect(await correcteur.inconnus(mots)).toEqual(['fautte', 'xyzzyq', 'bouffonerie']);
  });

  it('plusieurs demandes à la fois reçoivent chacune leur réponse', { timeout: DELAI }, async () => {
    const [a, b, c] = await Promise.all([
      correcteur.inconnus(['fautte', 'maison']),
      correcteur.inconnus(['porte', 'xyzzyq']),
      correcteur.inconnus(['vilbrequin']),
    ]);
    expect([a, b, c]).toEqual([['fautte'], ['xyzzyq'], ['vilbrequin']]);
  });

  it('un mot trop long ou qui n’est pas une chaîne est écarté', { timeout: DELAI }, async () => {
    expect(await correcteur.inconnus(['x'.repeat(200), 5 as unknown as string, 'fautte'])).toEqual(['fautte']);
  });
});

describe('sans PowerShell', () => {
  it('aucun mot n’est inconnu, sans erreur', { timeout: DELAI }, async () => {
    const c = creerCorrecteur({ powershell: 'C:\\introuvable\\powershell.exe' });
    expect(await c.inconnus(['fautte'])).toEqual([]);
    c.fermer();
  });
});
