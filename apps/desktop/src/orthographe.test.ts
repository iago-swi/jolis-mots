import { spawn } from 'node:child_process';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { argumentsPowerShell, creerCorrecteur, POWERSHELL } from './orthographe';

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

describe.runIf(process.platform === 'win32')('le programme PowerShell', () => {
  it('une ligne illisible reçoit [] et le programme continue', { timeout: DELAI }, async () => {
    const e = spawn(POWERSHELL, argumentsPowerShell(), { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let sortie = '';
    e.stdout.setEncoding('utf8');
    e.stdout.on('data', (m: string) => (sortie += m));
    const lignes = async (n: number) => {
      const fin = Date.now() + DELAI;
      while (sortie.split('\n').filter((l) => l.trim() !== '').length < n && Date.now() < fin) await new Promise((r) => setTimeout(r, 20));
      return sortie.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    };
    expect((await lignes(1))[0]).toMatch(/^PRET /);
    e.stdin.write('{ pas du json\n');
    e.stdin.write('["fautte","maison"]\n');
    expect((await lignes(3)).slice(1)).toEqual(['[]', '[0]']);
    e.stdin.end();
  });

  it('sans contournement de la stratégie d’exécution', () => {
    expect(argumentsPowerShell().map((a) => a.toLowerCase())).not.toContain('-executionpolicy');
  });
});

describe('le correcteur hors service', () => {
  it('le dit dans le journal, avec la cause', { timeout: DELAI }, async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const c = creerCorrecteur({ powershell: 'C:\\introuvable\\powershell.exe' });
      expect(await c.inconnus(['fautte'])).toEqual([]);
      expect(await c.inconnus(['fautte'])).toEqual([]);
      expect(journal).toHaveBeenCalledTimes(1);
      expect(String(journal.mock.calls[0]?.join(' '))).toMatch(/hors service.*ENOENT/s);
      c.fermer();
    } finally {
      journal.mockRestore();
    }
  });
});
