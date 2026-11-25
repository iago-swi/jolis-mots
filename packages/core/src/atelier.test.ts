import { describe, expect, it } from 'vitest';
import {
  adresseCnrtl,
  compterFiltres,
  genresUtilises,
  groupesDeDoublons,
  homonymes,
  lignesDeSources,
  listerAtelier,
  nettoyerFiche,
  nouvelleFiche,
  poserFiche,
  proposerTri,
  retirerFiche,
} from './atelier';
import type { Mot } from './types';

function fiche(id: string, mot: string, tri: string, extra: Partial<Mot> = {}): Mot {
  return { id, mot, tri, genre: '', definition: 'une définition', sources: [], note: '', util: '', aCompleter: false, ...extra };
}

const cave1 = fiche('cave1', 'Cave', 'cave');
const cave2 = fiche('cave2', 'Cave', 'cave');
const bistre = fiche('bistre', 'Bistre', 'bistre');
const bistreAccent = fiche('bistreAccent', 'Bistré', 'bistré');
const aboucher = fiche('abo1', 'Aboucher', 'aboucher');
const sAboucher = fiche('abo2', "S'aboucher (avec)", 'aboucher');
const venusteComplet = fiche('venuste', 'Vénuste', 'vénuste');
const venusteACompleter = fiche('venuste2', 'Vénusté', 'vénusté', { definition: '', aCompleter: true });
const liste = [venusteComplet, venusteACompleter, cave1, sAboucher, bistre, cave2, aboucher, bistreAccent];

describe('proposerTri', () => {
  it('propose la clé de tri', () => {
    expect(proposerTri("S'abolir")).toBe('abolir');
    expect(proposerTri('Se carrer')).toBe('carrer');
    expect(proposerTri('L’Érèbe')).toBe('érèbe');
    expect(proposerTri("S'aboucher (avec)")).toBe('aboucher');
    expect(proposerTri('Attiger, atiger')).toBe('attiger');
    expect(proposerTri('  Vénuste\u00a0')).toBe('vénuste');
    expect(proposerTri('Sans ambages')).toBe('sans ambages');
    expect(proposerTri('')).toBe('');
  });

  it('retire un seul préfixe et les espaces insécables fines', () => {
    expect(proposerTri('Le la lune')).toBe('la lune');
    expect(proposerTri('\u202fUne cave\u202f')).toBe('cave');
    expect(proposerTri('Les ormes')).toBe('ormes');
  });
});

describe('groupesDeDoublons', () => {
  it('lie les mots de même mot ou de même tri, accents comptés', () => {
    expect(groupesDeDoublons([cave1, cave2, bistre, bistreAccent]).map((g) => g.map((m) => m.id))).toEqual([['cave1', 'cave2']]);
    expect(groupesDeDoublons([aboucher, sAboucher])).toHaveLength(1);
  });

  it('est transitif', () => {
    const a = fiche('a', 'Alpha', 'x1');
    const b = fiche('b', 'Alpha', 'x2');
    const c = fiche('c', 'Gamma', 'x2');
    expect(groupesDeDoublons([a, b, c])[0]).toHaveLength(3);
  });

  it('compare en minuscules, espaces réduits et bords retirés', () => {
    expect(groupesDeDoublons([{ ...cave1, mot: 'cave ' }, cave2])).toHaveLength(1);
    const a = fiche('a', 'Pied  de\u00a0biche', 'pied de biche');
    const b = fiche('b', ' pied de biche\u202f', 'autre');
    expect(groupesDeDoublons([a, b])).toHaveLength(1);
  });

  it('ne lie pas les fiches dont le mot ou le tri est vide', () => {
    expect(groupesDeDoublons([fiche('a', '', ''), fiche('b', '', '')])).toEqual([]);
  });

  it('range les groupes selon leur premier mot', () => {
    const ids = groupesDeDoublons(liste).map((g) => g.map((m) => m.id));
    expect(ids).toEqual([['abo1', 'abo2'], ['cave1', 'cave2']]);
  });
});

describe('compterFiltres', () => {
  it('compte chaque filtre', () => {
    const n = compterFiltres(liste);
    expect(n.tous).toBe(liste.length);
    expect(n.complets + n.aCompleter).toBe(n.tous);
    expect(n.aCompleter).toBe(1);
    expect(n.doublons).toBe(groupesDeDoublons(liste).flat().length);
    expect(n.doublons).toBe(4);
  });

  it('À vérifier : vide sans fonction ; sinon les mots qu’elle retient', () => {
    expect(compterFiltres(liste).aVerifier).toBe(0);
    expect(compterFiltres(liste, (m) => m.tri.startsWith('b')).aVerifier).toBe(2);
  });
});

describe('listerAtelier, À vérifier', () => {
  it('vide sans fonction ; sinon les mots retenus, rangés, et la recherche s’applique', () => {
    expect(listerAtelier(liste, { filtre: 'aVerifier', requete: '' })).toEqual([]);
    const aVerifier = (m: Mot) => m.id === 'cave2' || m.id === 'bistre' || m.id === 'venuste2';
    expect(listerAtelier(liste, { filtre: 'aVerifier', requete: '', aVerifier }).map((m) => m.id)).toEqual(['bistre', 'cave2', 'venuste2']);
    expect(listerAtelier(liste, { filtre: 'aVerifier', requete: 'CAVE', aVerifier }).map((m) => m.id)).toEqual(['cave2']);
    // Les autres filtres ne la regardent pas.
    expect(listerAtelier(liste, { filtre: 'tous', requete: '', aVerifier })).toHaveLength(liste.length);
  });
});

describe('listerAtelier', () => {
  it('filtre selon la recherche, sans accents ni majuscules, dans un filtre', () => {
    expect(listerAtelier(liste, { filtre: 'aCompleter', requete: 'VENUS' }).map((m) => m.mot)).toEqual(['Vénusté']);
    expect(listerAtelier(liste, { filtre: 'complets', requete: 'venus' }).map((m) => m.mot)).toEqual(['Vénuste']);
    expect(listerAtelier(liste, { filtre: 'tous', requete: 'venus' }).map((m) => m.mot)).toEqual(['Vénuste', 'Vénusté']);
  });

  it('range dans l\'ordre du fichier', () => {
    expect(listerAtelier(liste, { filtre: 'tous', requete: '' }).map((m) => m.id)).toEqual([
      'abo1', 'abo2', 'bistre', 'bistreAccent', 'cave1', 'cave2', 'venuste', 'venuste2',
    ]);
  });

  it('garde les groupes de doublons entiers et côte à côte', () => {
    expect(listerAtelier(liste, { filtre: 'doublons', requete: '' }).map((m) => m.id)).toEqual(['abo1', 'abo2', 'cave1', 'cave2']);
  });

  it('dans les doublons, la recherche garde le groupe entier dès qu’un de ses mots répond', () => {
    // « avec » n'est que dans « S'aboucher (avec) » : « Aboucher », de même tri, reste à côté.
    expect(listerAtelier(liste, { filtre: 'doublons', requete: 'avec' }).map((m) => m.id)).toEqual(['abo1', 'abo2']);
    expect(listerAtelier(liste, { filtre: 'tous', requete: 'avec' }).map((m) => m.id)).toEqual(['abo2']);
    expect(listerAtelier(liste, { filtre: 'doublons', requete: 'bistre' })).toEqual([]);
  });
});

describe('genresUtilises', () => {
  it('classe par emplois décroissants puis alphabétique, sans le vide', () => {
    const adj = fiche('1', 'a', 'a', { genre: 'adj.' });
    const adj2 = fiche('2', 'b', 'b', { genre: 'adj.' });
    const verbe = fiche('3', 'c', 'c', { genre: 'verbe trans.' });
    const sansGenre = fiche('4', 'd', 'd');
    expect(genresUtilises([adj, adj2, verbe, sansGenre])).toEqual(['adj.', 'verbe trans.']);
    const nom = fiche('5', 'e', 'e', { genre: 'nom' });
    expect(genresUtilises([verbe, nom])).toEqual(['nom', 'verbe trans.']);
  });
});

describe('homonymes', () => {
  it('donne les autres mots de même mot ou de même tri', () => {
    expect(homonymes([cave1, cave2], cave1)).toEqual({ parMot: [cave2], parTri: [cave2] });
    expect(homonymes([aboucher, sAboucher], aboucher)).toEqual({ parMot: [], parTri: [sAboucher] });
    expect(homonymes([cave1], cave1)).toEqual({ parMot: [], parTri: [] });
  });
});

describe('adresseCnrtl', () => {
  it('encode le tri sans espaces aux bords', () => {
    expect(adresseCnrtl(' éployer ')).toBe('https://www.cnrtl.fr/definition/%C3%A9ployer');
  });
});

describe('fiche', () => {
  it('nouvelleFiche est vide et à compléter', () => {
    expect(nouvelleFiche('k3f9x2')).toEqual({
      id: 'k3f9x2', mot: '', tri: '', genre: '', definition: '', sources: [], note: '', util: '', aCompleter: true,
    });
  });

  it('nettoyerFiche ne touche que mot et tri', () => {
    const brute = { ...cave1, mot: ' Cave\u00a0', tri: ' cave\u202f', definition: '  1. Texte \n\n ', genre: ' adj. ', note: ' 8 ' };
    const avant = JSON.parse(JSON.stringify(brute));
    expect(nettoyerFiche(brute)).toEqual({ ...brute, mot: 'Cave', tri: 'cave' });
    expect(brute).toEqual(avant);
  });

  it('lignesDeSources garde chaque ligne non vide telle quelle', () => {
    expect(lignesDeSources('A: B (1)\n\n C \n')).toEqual(['A: B (1)', ' C ']);
    expect(lignesDeSources('A\r\nB')).toEqual(['A', 'B']);
    expect(lignesDeSources('')).toEqual([]);
  });

  it('poserFiche remplace ou ajoute, sans modifier l\'entrée', () => {
    const mots = [cave1];
    const copie = JSON.parse(JSON.stringify(mots));
    expect(poserFiche(mots, { ...cave1, genre: 'x' })).toEqual([{ ...cave1, genre: 'x' }]);
    expect(poserFiche(mots, cave2)).toHaveLength(2);
    expect(mots).toEqual(copie);
    expect(mots).toHaveLength(1);
  });

  it('retirerFiche retire par identifiant, sans modifier l\'entrée', () => {
    const mots = [cave1, cave2];
    expect(retirerFiche(mots, 'cave1')).toEqual([cave2]);
    expect(retirerFiche(mots, 'inconnu')).toEqual([cave1, cave2]);
    expect(mots).toEqual([cave1, cave2]);
  });
});
