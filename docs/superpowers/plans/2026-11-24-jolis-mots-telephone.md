# Jolis Mots, plan 1 : l'application du téléphone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importer les mots de l'Excel et livrer l'application Android (écrans Mot, Recueil, Quiz, Réglages) en version 0.1.0, avec mise à jour de la liste en ligne.

**Architecture:** Un dépôt npm à espaces de travail. `packages/core` contient toute la logique sans interface (lecture des définitions, import, mémoire, quiz), testée avec Vitest. `apps/web` est l'application Svelte qui l'affiche ; `apps/android` l'emballe avec Capacitor. La liste des mots vit sur la branche `donnees`, montée dans le dossier `donnees/` du dépôt.

**Tech Stack:** TypeScript ^7.0.2, Svelte ^5.56.10, Vite ^8.2.2, @sveltejs/vite-plugin-svelte ^7.3.0, Vitest ^4.1.11, tsx ^4.23.12, svelte-check, @fontsource/eb-garamond, Capacitor 8.5.0 (core, android, cli), sharp ^0.35.3, Python 3 avec openpyxl (extraction de l'Excel seulement).

**Spec:** `docs/superpowers/specs/2026-11-24-jolis-mots-design.md`. Maquette : `docs/superpowers/specs/maquette/` (`Main.dc.html`, `Quiz.dc.html`, `Recueil.dc.html` pour les écrans, `variantes.html` pour les palettes). Modèle technique : `..\Capitales\Claude\` (mêmes outils, déjà en service sur cette machine).

**Hors de ce plan :** la version Windows et l'atelier (plan 2, version 1.0.0).

## Global Constraints

- Tous les textes de l'application, les messages de commit, la documentation et les notes de version sont en français.
- Un mot est **complet** quand `definition` n'est pas vide et que `aCompleter` est faux. Seuls les mots complets apparaissent dans Mot, Quiz et Recueil.
- Le texte enregistré (`mot`, `definition`, `sources`…) n'est jamais modifié par l'affichage. Développer une abréviation ou embellir la typographie se fait à l'affichage seulement.
- Aucun écran n'a besoin du réseau pour montrer un mot. Les polices sont embarquées (`@fontsource/eb-garamond`) ; aucune ressource n'est chargée d'un CDN.
- Une seule police : EB Garamond. Six couleurs par palette, valeurs exactes de la section 9 de la conception. Aucune couleur en dur dans un composant : uniquement les variables `--papier`, `--encre`, `--second`, `--filet`, `--exemple`, `--accent`.
- Zones tactiles d'au moins 44 px. Contraste du texte d'au moins 4,5 pour 1. Aucun mouvement si `prefers-reduced-motion: reduce`.
- Pas d'habillage de jeu : ni score, ni points, ni série, ni confettis.
- Identifiant Android : `ch.noth.jolismots`. Nom affiché : `Jolis Mots`.
- Adresse de la liste : `https://raw.githubusercontent.com/iago-swi/jolis-mots/donnees/mots.json`.
- `vocabulaire.xlsx` n'est jamais ajouté au dépôt ni modifié.
- Tout le travail se fait sur la branche `release/jolis-mots-v0.1.0`. Rien n'est validé sur `main`. Messages de commit simples, sans ligne d'attribution. Suivre `VERSIONING.md`.
- Chemins Windows avec espaces et tirets demi-cadratin : toujours entre guillemets.

## Review Focus

1. **Mots et expressions longs** (« Abracadabrantesque », « Grosjean comme devant ») : le mot en grand ne déborde jamais de l'écran de 390 px. Tâches 3 et 8.
2. **Définitions qui ne suivent pas les conventions** (copie brute du CNRTL, balise avec espace, lignes vides, texte sans balise) : tout le texte reste affiché, aucun mot perdu. Tâches 2 et 4.
3. **Liste téléchargée invalide** (page d'erreur HTML, fichier tronqué, mauvais format) : la liste en place est gardée, rien n'est signalé. Tâche 11.
4. **Stockage local illisible ou absent** (JSON corrompu, quota dépassé, accès refusé) : l'application démarre avec des progrès vides. Tâche 8.
5. **Trop peu de mots** (aucun mot complet, moins de quatre mots, tous les mots déjà vus, progrès qui citent un mot supprimé) : chaque écran affiche un état calme, le quiz se compose quand même, rien ne boucle. Tâches 5, 7 et 10.

---

### Task 1: Échafaudage et types

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `version.ts`
- Create: `packages/core/package.json`, `packages/core/src/index.ts`, `packages/core/src/types.ts`
- Test: `packages/core/src/types.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Mot {
  id: string; mot: string; tri: string; genre: string; definition: string;
  sources: string[]; note: string; util: string; aCompleter: boolean;
}
export interface FichierMots { format: 1; publie: string; mots: Mot[] }
export function estComplet(m: Mot): boolean;
```

- [ ] **Step 1:** Créer la branche : `git switch -c release/jolis-mots-v0.1.0`.
- [ ] **Step 2:** Écrire `package.json` à la racine : `"name": "jolis-mots"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`, `"workspaces": ["packages/*", "apps/*"]`, les dépendances de développement de la ligne Tech Stack, et les scripts `test` (`vitest run`), `typecheck` (`tsc -p tsconfig.base.json --noEmit`). Copier `tsconfig.base.json`, `vitest.config.ts` et `version.ts` de `..\Capitales\Claude\` ; dans `vitest.config.ts`, le motif devient `{packages,apps}/**/src/**/*.test.ts` ; dans `version.ts`, le nom du plugin devient `jolis-mots-version`. `packages/core/package.json` : `"name": "@jolis-mots/core"`, `"exports": { ".": "./src/index.ts" }`.
- [ ] **Step 3: Écrire le test qui échoue**

```ts
import { expect, it } from 'vitest';
import { estComplet, type Mot } from './types';

const base: Mot = { id: 'a', mot: 'Accore', tri: 'accore', genre: 'adj.', definition: 'Abrupt.', sources: [], note: '', util: '', aCompleter: false };

it('un mot est complet avec une définition et sans marque « à compléter »', () => {
  expect(estComplet(base)).toBe(true);
  expect(estComplet({ ...base, definition: '   ' })).toBe(false);
  expect(estComplet({ ...base, aCompleter: true })).toBe(false);
});
```

- [ ] **Step 4:** `npm install`, puis `npm test`. Attendu : échec, `estComplet` introuvable.
- [ ] **Step 5:** Écrire `types.ts` et l'exporter depuis `index.ts`.
- [ ] **Step 6:** `npm test` et `npm run typecheck`. Attendu : tout passe.
- [ ] **Step 7:** Commit : `git commit -m "Échafaudage du projet et types des mots"`.

### Task 2: Lecture des définitions

**Files:**
- Create: `packages/core/src/definition.ts`
- Test: `packages/core/src/definition.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Sens {
  numero: string | null;      // "1", "2"… ou null
  indication: string | null;  // contenu des crochets en tête de sens, sans les crochets
  texte: string;
  exemples: string[]; synonymes: string[]; antonymes: string[]; usages: string[];
}
export function lireDefinition(texte: string): Sens[];
export function developperIndication(indication: string): string;
```

Règles (conception, section 6.2) :

- Les sens numérotés ne sont ouverts que si la première ligne non vide commence par `1.`. Une ligne suivante qui commence par un nombre suivi d'un point ouvre un nouveau sens ; toute autre ligne se rattache au sens en cours, précédée d'un saut de ligne.
- Dans un sens, des crochets tout au début donnent `indication` ; les crochets placés ailleurs restent dans `texte`.
- Balises, en majuscules uniquement, avec ou sans espace avant les deux-points : `EX` (exemples), `SYN` (synonymes), `US` (usages), `ANT` et `ANTON` (antonymes). Une balise court jusqu'à la suivante ou la fin du sens.
- Synonymes et antonymes sont séparés aux virgules ; le point final est retiré.
- Un texte vide rend `[]`.
- `developperIndication` découpe aux virgules, développe chaque terme connu et met en minuscule tous les termes sauf le premier. Table : `Litt.` Littéraire, `Fig.` Figuré, `Par ext.` Par extension, `Par anal.` Par analogie, `Par méton.` Par métonymie, `Par métaph.` Par métaphore, `Fam.` Familier, `Péj.` Péjoratif, `Pop.` Populaire, `Vulg.` Vulgaire, `Argot.` Argot, `Poét.` Poétique, `Iron.` Ironique. Un terme inconnu est laissé tel quel.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, expect, it } from 'vitest';
import { developperIndication, lireDefinition } from './definition';

const vide = { exemples: [], synonymes: [], antonymes: [], usages: [] };

describe('lireDefinition', () => {
  it('lit un sens unique avec son exemple', () => {
    expect(lireDefinition("Cesser d'être, d'exister. EX: Ton saint nom s'abolir.")).toEqual([
      { ...vide, numero: null, indication: null, texte: "Cesser d'être, d'exister.", exemples: ["Ton saint nom s'abolir."] },
    ]);
  });
  it('lit des sens numérotés, une indication et des synonymes', () => {
    const s = lireDefinition('1. Passer son temps à des choses frivoles. SYN: muser.\n2. [Par ext.] Se promener sans but précis, flâner. EX: Le Bouvron baguenaudant.');
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ numero: '1', indication: null, texte: 'Passer son temps à des choses frivoles.', synonymes: ['muser'] });
    expect(s[1]).toMatchObject({ numero: '2', indication: 'Par ext.', texte: 'Se promener sans but précis, flâner.', exemples: ['Le Bouvron baguenaudant.'] });
  });
  it('accepte une espace avant les deux-points et sépare les synonymes', () => {
    const [s] = lireDefinition('Mener une vie paresseuse. SYN: cagnarder, fainéanter. EX : Ils s’acagnardent dans leur lit.');
    expect(s?.synonymes).toEqual(['cagnarder', 'fainéanter']);
    expect(s?.exemples).toEqual(['Ils s’acagnardent dans leur lit.']);
  });
  it('lit US, ANT et ANTON', () => {
    const [s] = lireDefinition('Sans détours. US: Parler sans ambages. ANTON: détour. ANT: ambages.');
    expect(s).toMatchObject({ usages: ['Parler sans ambages.'], antonymes: ['détour', 'ambages'] });
  });
  it('laisse dans le texte les crochets qui ne sont pas en tête', () => {
    const [s] = lireDefinition("Baquet tenant lieu de fosse d'aisances. [Par méton., gén. au plur.] Lieux d'aisances.");
    expect(s).toMatchObject({ indication: null, texte: "Baquet tenant lieu de fosse d'aisances. [Par méton., gén. au plur.] Lieux d'aisances." });
  });
  it("n'ouvre pas de sens numérotés si le texte ne commence pas par 1.", () => {
    const brut = 'A. − Passer son temps à rêvasser.\n1. ... Pierre Brueghel avait fait le voyage.';
    expect(lireDefinition(brut)).toEqual([{ ...vide, numero: null, indication: null, texte: brut }]);
  });
  it('rend un tableau vide pour un texte vide', () => {
    expect(lireDefinition('  \n ')).toEqual([]);
  });
  it('ne perd aucun mot du texte', () => {
    const brut = '1. [Fig.] Endurci. EX: Le cœur calleux.\n\nligne isolée (biere)\n2. ex: minuscule SYN:dur, sec.';
    const motsDe = (t: string) => t.replace(/\b(EX|SYN|US|ANTON|ANT) ?:/g, ' ').match(/[\p{L}\p{N}]+/gu) ?? [];
    const sortie = lireDefinition(brut).map((s) => [s.numero, s.indication, s.texte, ...s.exemples, ...s.synonymes, ...s.antonymes, ...s.usages].join(' ')).join(' ');
    for (const m of motsDe(brut)) expect(sortie).toContain(m);
  });
});

it('développe les indications connues et laisse les autres', () => {
  expect(developperIndication('Litt.')).toBe('Littéraire');
  expect(developperIndication('Fig., litt.')).toBe('Figuré, littéraire');
  expect(developperIndication("En parlant d'une côte")).toBe("En parlant d'une côte");
});
```

- [ ] **Step 2:** `npm test`. Attendu : échec, module introuvable.
- [ ] **Step 3:** Écrire `definition.ts` selon les règles ci-dessus et l'exporter depuis `index.ts`.
- [ ] **Step 4:** `npm test`. Attendu : tout passe.
- [ ] **Step 5:** Commit : `git commit -m "Lecture des définitions et de leurs balises"`.

### Task 3: Genre, sources, typographie

**Files:**
- Create: `packages/core/src/genre.ts`, `packages/core/src/sources.ts`, `packages/core/src/typographie.ts`
- Test: un fichier `.test.ts` à côté de chacun

**Interfaces:**
- Produces:

```ts
// genre.ts
export function developperGenre(genre: string): string;
export function premierTerme(genre: string): string; // "adj.", "subst.", "verbe"…
// sources.ts
export interface Source { auteur: string | null; titre: string; pages: string | null }
export function lireSource(ligne: string): Source;
export function afficherPages(pages: string): string;
export function auteursParNombre(mots: Mot[]): { auteur: string; nombre: number }[];
// typographie.ts
export function embellir(texte: string): string;
export function entreGuillemets(texte: string): string;
export function tailleDuMot(mot: string): number; // taille de police en px pour 334 px de large
```

Règles :

- `developperGenre` découpe sur ` + ` (rendu « et »), puis développe chaque terme : `adj.` adjectif, `subst.` nom, `masc.` masculin, `fém.` féminin, `plur.` pluriel, `inv.` invariable, `verbe` verbe, `trans.` transitif, `intrans.` intransitif, `pronom.` pronominal, `indir.` indirect, `impers.` impersonnel, `défectif` défectif, `adv.` adverbe, `expr.` expression, `interj.` interjection, `conj.` conjonction, `loc.` locution. Cas entier traité avant le découpage : `loc. adv.` donne « locution adverbiale ». Un terme inconnu est laissé tel quel.
- `lireSource` coupe au premier `: ` (auteur avant, reste après). Des parenthèses finales qui ne contiennent que chiffres, virgules, espaces et tirets sont les pages ; d'autres parenthèses font partie du titre.
- `afficherPages('82,319')` rend `p. 82, 319`.
- `auteursParNombre` compte les mots (pas les lignes de source) par auteur, ignore les sources sans auteur, trie par nombre décroissant puis par ordre alphabétique.
- `embellir` remplace `'` par `’` et `...` par `…`. Rien d'autre : la ponctuation haute reste telle que saisie.
- `entreGuillemets` rend `«` + espace fine insécable (U+202F) + texte + U+202F + `»`, sauf si le texte commence déjà par `«`.
- `tailleDuMot` : 62 jusqu'à 9 caractères, puis `62 × 9 ÷ longueur`, arrondi, jamais sous 34.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// genre.test.ts
it.each([
  ['adj.', 'adjectif'], ['subst. masc.', 'nom masculin'], ['subst. fém. plur.', 'nom féminin pluriel'],
  ['verbe trans.', 'verbe transitif'], ['verbe pronom.', 'verbe pronominal'], ['loc. adv.', 'locution adverbiale'],
  ['expr.', 'expression'], ['adj. + subst. masc.', 'adjectif et nom masculin'], ['subst. C2223', 'nom C2223'], ['', ''],
])('développe %s', (abrege, attendu) => expect(developperGenre(abrege)).toBe(attendu));
it('donne le premier terme', () => {
  expect(premierTerme('subst. fém. plur.')).toBe('subst.');
  expect(premierTerme('verbe trans. + verbe intrans.')).toBe('verbe');
});

// sources.test.ts
it('lit auteur, titre et pages', () => {
  expect(lireSource('Nicolas Bouvier: Le Poisson-Scorpion (172)')).toEqual({ auteur: 'Nicolas Bouvier', titre: 'Le Poisson-Scorpion', pages: '172' });
  expect(lireSource("Nicolas Bouvier: L'Usage du Monde (82,319)").pages).toBe('82,319');
  expect(lireSource('Dictionnaire des mots savants (employés à tort et à travers)')).toEqual({ auteur: null, titre: 'Dictionnaire des mots savants (employés à tort et à travers)', pages: null });
  expect(lireSource('Anne Marie Jaton: Nicolas Bouvier. Paroles du monde').auteur).toBe('Anne Marie Jaton');
});
it('affiche les pages', () => expect(afficherPages('82,319')).toBe('p. 82, 319'));

// typographie.test.ts
it('embellit sans toucher à la ponctuation haute', () => {
  expect(embellir("L'eau (...) charme; qui plaît")).toBe('L’eau (…) charme; qui plaît');
  expect(entreGuillemets('Nuit céruléenne.')).toBe('«\u202FNuit céruléenne.\u202F»');
  expect(entreGuillemets('« Déjà. »')).toBe('« Déjà. »');
});
it('réduit la taille des mots longs', () => {
  expect(tailleDuMot('Céruléen')).toBe(62);
  expect(tailleDuMot('Abracadabrantesque')).toBe(34);
  expect(tailleDuMot('Baguenauder')).toBe(51);
});
```

Ajouter un test de `auteursParNombre` avec trois mots dont deux de Bouvier : résultat `[{ auteur: 'Nicolas Bouvier', nombre: 2 }, …]`.

- [ ] **Step 2:** `npm test`. Attendu : échec.
- [ ] **Step 3:** Écrire les trois modules et les exporter depuis `index.ts`.
- [ ] **Step 4:** `npm test`. Attendu : tout passe.
- [ ] **Step 5:** Commit : `git commit -m "Affichage du genre, des sources et de la typographie"`.

### Task 4: Import de l'Excel

**Files:**
- Create: `packages/core/src/import.ts`, `packages/core/src/fichier.ts`
- Create: `tools/import/extraire.py`, `tools/import/importer.ts`
- Modify: `package.json` (script `import`), `.gitignore` (ajouter `donnees/` et `tools/import/sortie/`)
- Test: `packages/core/src/import.test.ts`, `packages/core/src/fichier.test.ts`

**Interfaces:**
- Consumes: `Mot`, `FichierMots`, `estComplet`, `premierTerme`.
- Produces:

```ts
// import.ts
export interface LigneExcel { mot: string; tri: string; genre: string; definition: string; note: string; util: string; source: string; rouge: boolean }
export interface RapportImport {
  lignes: number; mots: number; complets: number; aCompleter: number;
  doublonsFusionnes: string[];   // mots dont des lignes vides ont été écartées
  doublonsGardes: string[];      // mots présents plusieurs fois après import
  lignesRouges: string[];
  aCompleterAvecTexte: string[]; // marqués « à compléter » avec du texte en définition
  genresInhabituels: string[];   // "Mot : genre"
}
export function importer(lignes: LigneExcel[], options: { publie: string; creerId: () => string; existant?: FichierMots }): { fichier: FichierMots; rapport: RapportImport };
export function rapportEnMarkdown(r: RapportImport): string;
// fichier.ts
export function ecrireFichier(f: FichierMots): string;            // un mot par ligne, trié
export function validerFichier(x: unknown): FichierMots | null;   // null si la forme n'est pas la bonne
export function creerId(): string;                                // 6 caractères parmi [a-z0-9]
```

Règles (conception, section 8) :

- Mot et Tri : espaces retirées en début et en fin, insécables (U+00A0) comprises.
- Une ligne qui porte `###` dans Genre ou dans Définition reçoit `aCompleter: true` ; les `###` sont retirés des deux champs, le reste du texte est gardé, puis nettoyé de ses espaces en début et en fin. Une ligne sans définition reçoit aussi `aCompleter: true`.
- Source : découpée aux sauts de ligne ; les lignes vides et les `-` sont écartés.
- Lignes rouges : importées telles quelles, jamais fusionnées ni écartées.
- Autres doublons (même `mot` sans majuscules ni espaces en trop, hors lignes rouges) : si une seule ligne a une définition, elle est gardée, reçoit les sources de toutes, et les autres sont écartées ; si plusieurs en ont une, toutes sont gardées ; si aucune, une seule est gardée, avec les sources de toutes.
- `existant` : un mot retrouvé avec les mêmes `mot` et `tri` reprend son `id`, pour qu'un nouvel import ne casse pas les progrès.
- Tri final : selon `tri` sans accents ni majuscules, puis `mot`.
- Un genre est inhabituel si un de ses termes n'est pas dans la table de `developperGenre`.
- `ecrireFichier` rend un JSON valide avec une ligne par mot. `validerFichier` exige `format === 1`, `publie` chaîne, `mots` tableau dont chaque élément a toutes les propriétés de `Mot` avec le bon type.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
const ligne = (p: Partial<LigneExcel>): LigneExcel => ({ mot: '', tri: '', genre: '', definition: '', note: '', util: '', source: '', rouge: false, ...p });
let n = 0; const options = () => ({ publie: '2026-11-24T10:00:00Z', creerId: () => `id${++n}` });

it('marque « à compléter » et retire les dièses sans perdre le texte', () => {
  const { fichier } = importer([
    ligne({ mot: 'Impresse', tri: 'impresse', genre: '### adj.' }),
    ligne({ mot: 'Ecluser', tri: 'ecluser', genre: '###', definition: '(biere)' }),
    ligne({ mot: 'Quitus', tri: 'quitus', genre: 'subst. masc.', definition: '###' }),
    ligne({ mot: 'Hiémal', tri: 'hiémal', genre: '###', definition: "Qui appartient à l'hiver." }),
    ligne({ mot: 'Accore', tri: 'accore', genre: 'adj.', definition: 'Abrupt.' }),
  ], options());
  const par = Object.fromEntries(fichier.mots.map((m) => [m.mot, m]));
  expect(par['Impresse']).toMatchObject({ genre: 'adj.', definition: '', aCompleter: true });
  expect(par['Ecluser']).toMatchObject({ genre: '', definition: '(biere)', aCompleter: true });
  expect(par['Quitus']).toMatchObject({ genre: 'subst. masc.', definition: '', aCompleter: true });
  expect(par['Hiémal']).toMatchObject({ definition: "Qui appartient à l'hiver.", aCompleter: true });
  expect(par['Accore']?.aCompleter).toBe(false);
});
it('nettoie les espaces insécables et les sources', () => {
  const { fichier } = importer([ligne({ mot: 'épure\u00a0', tri: 'épure\u00a0', source: 'A: T (1)\n-\n\nB: U' })], options());
  expect(fichier.mots[0]).toMatchObject({ mot: 'épure', tri: 'épure', sources: ['A: T (1)', 'B: U'] });
});
it('fusionne un doublon vide avec la fiche complète, sauf en rouge', () => {
  const { fichier, rapport } = importer([
    ligne({ mot: 'Cacique', tri: 'cacique', genre: 'subst. masc.', definition: 'Chef.', source: 'A: T' }),
    ligne({ mot: 'cacique\u00a0', tri: 'cacique', genre: '###', source: 'B: U' }),
    ligne({ mot: 'Cave', tri: 'cave', genre: 'adj.', definition: 'Niais.', rouge: true }),
    ligne({ mot: 'Cave', tri: 'cave', genre: '###', rouge: true }),
  ], options());
  expect(fichier.mots.filter((m) => m.tri === 'cacique')).toHaveLength(1);
  expect(fichier.mots.find((m) => m.tri === 'cacique')?.sources).toEqual(['A: T', 'B: U']);
  expect(fichier.mots.filter((m) => m.tri === 'cave')).toHaveLength(2);
  expect(rapport.doublonsFusionnes).toEqual(['Cacique']);
  expect(rapport.lignesRouges).toEqual(['Cave', 'Cave']);
});
it('reprend les identifiants d’un import précédent et trie selon Tri', () => {
  const premier = importer([ligne({ mot: "S'abolir", tri: 'abolir' }), ligne({ mot: 'Zèle', tri: 'zele' }), ligne({ mot: 'Écrin', tri: 'écrin' })], options()).fichier;
  const second = importer([ligne({ mot: 'Zèle', tri: 'zele' }), ligne({ mot: "S'abolir", tri: 'abolir' })], { ...options(), existant: premier }).fichier;
  expect(premier.mots.map((m) => m.mot)).toEqual(["S'abolir", 'Écrin', 'Zèle']);
  expect(second.mots.map((m) => m.id)).toEqual([premier.mots[0]!.id, premier.mots[2]!.id]);
});
// fichier.test.ts
it('écrit un mot par ligne et se relit à l’identique', () => {
  const { fichier } = importer([ligne({ mot: 'A', tri: 'a' }), ligne({ mot: 'B', tri: 'b' })], options());
  const texte = ecrireFichier(fichier);
  expect(texte.split('\n').filter((l) => l.includes('"id"'))).toHaveLength(2);
  expect(validerFichier(JSON.parse(texte))).toEqual(fichier);
});
it.each([[null], ['<html>Not found</html>'], [{ format: 2, publie: '', mots: [] }], [{ format: 1, publie: '', mots: [{ id: 'a' }] }]])('refuse %j', (x) => expect(validerFichier(x)).toBeNull());
```

- [ ] **Step 2:** `npm test`. Attendu : échec.
- [ ] **Step 3:** Écrire `import.ts` et `fichier.ts`, les exporter depuis `index.ts`. `npm test` : tout passe.
- [ ] **Step 4:** Écrire `tools/import/extraire.py` : `python -I tools/import/extraire.py <xlsx> <sortie.json>`. Il ouvre la feuille `Philippe` avec openpyxl, sans rien modifier, et écrit un tableau JSON d'objets `LigneExcel` à partir de la ligne 2 : colonnes A à G dans l'ordre Mot, Tri, Genre, Définition, Note, Util., Source, chaque cellule convertie en chaîne (cellule vide : chaîne vide), et `rouge` vrai quand le fond de la cellule A est la couleur `FFFF0000`.
- [ ] **Step 5:** Écrire `tools/import/importer.ts` (lancé par `tsx`) et le script `"import": "python -I tools/import/extraire.py vocabulaire.xlsx tools/import/sortie/lignes.json && tsx tools/import/importer.ts"`. Il lit `tools/import/sortie/lignes.json`, lit `donnees/mots.json` s'il existe (comme `existant`), appelle `importer`, écrit `donnees/mots.json` avec `ecrireFichier` et `tools/import/sortie/rapport-import.md` avec `rapportEnMarkdown`. Il refuse de tourner si le dossier `donnees/` n'existe pas, avec un message qui cite la commande de l'étape 6. Il compte aussi, sur les définitions réelles, celles pour lesquelles `lireDefinition` perd un mot (même contrôle que le test « ne perd aucun mot ») et inscrit ce nombre au rapport.
- [ ] **Step 6:** Monter la branche des données : `git worktree add --orphan -b donnees donnees`.
- [ ] **Step 7:** `npm run import`. Attendu dans le rapport : 2 552 lignes lues, environ 1 150 mots complets, 41 lignes rouges, 0 définition avec mot perdu. Si ce dernier nombre n'est pas 0, corriger `lireDefinition` (avec un test) avant de continuer.
- [ ] **Step 8:** Montrer `tools/import/sortie/rapport-import.md` à Philippe. Puis, dans `donnees/` : `git add mots.json`, `git commit -m "Import initial depuis l'Excel"`, `git push -u origin donnees`. Cet envoi rend la liste publique, comme décidé dans la conception.
- [ ] **Step 9:** Sur la branche de travail, commit : `git commit -m "Import de l'Excel vers mots.json"`.

### Task 5: Ordre, recherche et choix du mot

**Files:**
- Create: `packages/core/src/recherche.ts`, `packages/core/src/selection.ts`, `packages/core/src/memoire.ts` (types seulement)
- Test: un fichier `.test.ts` à côté de `recherche.ts` et de `selection.ts`

**Interfaces:**
- Consumes: `Mot`, `estComplet`, `lireSource`.
- Produces:

```ts
// memoire.ts : seulement ces deux types ici ; la tâche 6 y ajoute les fonctions
export interface EtatMot { vu: string; case: 1 | 2 | 3 | 4 | 5; du: string; acquis: boolean } // dates ISO
export type Progres = Record<string, EtatMot>;
// recherche.ts
export function normaliser(texte: string): string;       // minuscules, sans accents, ’ rendu '
export function ordonner(mots: Mot[]): Mot[];            // selon tri normalisé, puis mot
export function lettrine(m: Mot): string;                // première lettre du tri normalisé, en majuscule ; "#" si ce n'est pas une lettre
export interface Filtre { requete: string; auteur: string | null; favoris: string[] | null }
export function filtrer(mots: Mot[], f: Filtre): Mot[];  // requête cherchée dans mot et tri normalisés
// selection.ts
export function prochainMot(complets: Mot[], progres: Progres, seance: string[], alea: () => number): Mot | null;
```

`prochainMot` tire au hasard parmi les mots absents de `progres` et de `seance`. S'il n'y en a plus, il rend le mot hors `seance` dont la date `vu` est la plus ancienne. S'il ne reste aucun mot hors `seance`, il rend `null`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
it('ignore accents, majuscules et apostrophes courbes', () => {
  expect(normaliser('Éphémère')).toBe('ephemere');
  expect(normaliser('S’abolir')).toBe("s'abolir");
});
it('cherche dans le mot et dans le tri', () => {
  const mots = [mot('S’aboucher (avec)', 'aboucher'), mot('Écrin', 'écrin')];
  expect(filtrer(mots, { requete: 'ecr', auteur: null, favoris: null }).map((m) => m.mot)).toEqual(['Écrin']);
  expect(filtrer(mots, { requete: 'ABOU', auteur: null, favoris: null })).toHaveLength(1);
});
it('filtre par auteur et par favoris', () => { /* un mot de Bouvier, un de Tesson : auteur 'Nicolas Bouvier' en rend un ; favoris [id] en rend un */ });
it('donne la lettrine', () => { expect(lettrine(mot('Écrin', 'écrin'))).toBe('E'); expect(lettrine(mot('1984', '1984'))).toBe('#'); });
it('tire un mot jamais vu, puis le plus anciennement vu, puis rien', () => {
  const [a, b] = [mot('A', 'a'), mot('B', 'b')];
  expect(prochainMot([a, b], { [a.id]: etat('2026-01-01') }, [], () => 0)?.id).toBe(b.id);
  expect(prochainMot([a, b], { [a.id]: etat('2026-01-01'), [b.id]: etat('2026-02-01') }, [], () => 0)?.id).toBe(a.id);
  expect(prochainMot([a], {}, [a.id], () => 0)).toBeNull();
  expect(prochainMot([], {}, [], () => 0)).toBeNull();
});
```

`mot(...)` et `etat(...)` sont de petites fabriques écrites dans le fichier de test.

- [ ] **Step 2:** `npm test`. Attendu : échec.
- [ ] **Step 3:** Écrire les deux modules. `npm test` : tout passe.
- [ ] **Step 4:** Commit : `git commit -m "Recherche, ordre alphabétique et choix du mot"`.

### Task 6: Mémoire

**Files:**
- Modify: `packages/core/src/memoire.ts`
- Test: `packages/core/src/memoire.test.ts`

**Interfaces:**
- Consumes: `EtatMot`, `Progres` (tâche 5).
- Produces:

```ts
export const INTERVALLES: readonly number[]; // [1, 3, 7, 16, 35] jours, par case
export function marquerVu(p: Progres, id: string, maintenant: Date): Progres;   // sans effet si le mot est déjà connu
export function repondre(p: Progres, id: string, juste: boolean, maintenant: Date): Progres;
export function motsDus(p: Progres, maintenant: Date): string[];                // non acquis, dus, du plus ancien au plus récent
```

Un mot vu entre en case 1, dû un jour plus tard. Juste : il monte d'une case et devient dû après l'intervalle de sa nouvelle case ; en case 5, il devient `acquis`. Faux : retour en case 1, dû un jour plus tard. Les fonctions rendent un nouvel objet sans modifier l'ancien. `repondre` sur un mot inconnu le crée d'abord comme vu.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
const j = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
it('fait monter un mot de case en case jusqu’à acquis', () => {
  let p = marquerVu({}, 'a', j(0));
  expect(p['a']).toMatchObject({ case: 1, acquis: false, du: j(1).toISOString() });
  p = repondre(p, 'a', true, j(1));  expect(p['a']).toMatchObject({ case: 2, du: j(4).toISOString() });
  p = repondre(p, 'a', true, j(4));  expect(p['a']).toMatchObject({ case: 3, du: j(11).toISOString() });
  p = repondre(p, 'a', true, j(11)); expect(p['a']).toMatchObject({ case: 4, du: j(27).toISOString() });
  p = repondre(p, 'a', true, j(27)); expect(p['a']).toMatchObject({ case: 5, du: j(62).toISOString() });
  p = repondre(p, 'a', true, j(62)); expect(p['a']?.acquis).toBe(true);
  expect(motsDus(p, j(400))).toEqual([]);
});
it('renvoie un mot raté en case 1', () => {
  const p = repondre(repondre(marquerVu({}, 'a', j(0)), 'a', true, j(1)), 'a', false, j(4));
  expect(p['a']).toMatchObject({ case: 1, du: j(5).toISOString() });
});
it('liste les mots dus, du plus ancien au plus récent', () => {
  const p = marquerVu(marquerVu({}, 'a', j(2)), 'b', j(0));
  expect(motsDus(p, j(1))).toEqual(['b']);
  expect(motsDus(p, j(3))).toEqual(['b', 'a']);
});
it('ne modifie pas l’objet reçu', () => { const p = {}; marquerVu(p, 'a', j(0)); expect(p).toEqual({}); });
```

- [ ] **Step 2:** `npm test`. Attendu : échec.
- [ ] **Step 3:** Ajouter la constante et les trois fonctions à `memoire.ts`. `npm test` : tout passe.
- [ ] **Step 4:** Commit : `git commit -m "Mémoire à cinq cases"`.

### Task 7: Composition du quiz

**Files:**
- Create: `packages/core/src/quiz.ts`
- Test: `packages/core/src/quiz.test.ts`

**Interfaces:**
- Consumes: `Mot`, `lireDefinition`, `premierTerme`, `normaliser`, `motsDus`, `Progres`.
- Produces:

```ts
export type Forme = 'definition-vers-mot' | 'mot-vers-definition';
export interface Choix { id: string; texte: string }
export interface Question { idMot: string; forme: Forme; enonce: string; genre: string; choix: Choix[]; bonne: string }
export const QUESTIONS_MAX: number; // 10
export function definitionPourQuiz(m: Mot): string;
export function composerQuiz(a: { complets: Mot[]; seance: string[]; progres: Progres; maintenant: Date; alea: () => number }): Question[];
```

Règles (conception, section 5.2) :

- Les mots de `seance` viennent d'abord, dans l'ordre, puis les mots dus ; sans répétition ; dix questions au plus. Un identifiant qui n'est plus dans `complets` est ignoré.
- La forme alterne : `definition-vers-mot` pour les questions paires (0, 2…), `mot-vers-definition` pour les impaires.
- `definition-vers-mot` : `enonce` est `definitionPourQuiz` du mot, le `texte` de chaque choix est un `mot`. `mot-vers-definition` : `enonce` est le `mot`, le `texte` de chaque choix est sa `definitionPourQuiz`. `genre` est le `genre` du mot, tel qu'enregistré. `bonne` et l'`id` des choix sont des identifiants de mots.
- `definitionPourQuiz` rend le `texte` du premier sens, où toute occurrence du `mot` ou du `tri` (sans tenir compte de la casse ni des accents) est remplacée par `—`.
- Trois mauvaises réponses : d'abord parmi les mots de même `genre` exact, puis de même `premierTerme`, puis parmi tous. Jamais la bonne réponse, jamais un mot dont le `mot` ou le `tri` normalisé figure parmi les synonymes déclarés de la bonne réponse, jamais deux fois le même.
- Avec moins de quatre mots complets, la question a moins de choix ; avec un seul, `composerQuiz` rend `[]`.
- Les choix sont mélangés avec `alea`.

- [ ] **Step 1: Écrire les tests qui échouent**

Fabrique `mot(nom, genre, definition)` et dix mots de genres variés. Tests :

```ts
it('interroge la séance d’abord, puis les mots dus, dix au plus', () => { /* seance [c, a], dus [b] → idMot dans l'ordre c, a, b ; 12 mots dus → 10 questions */ });
it('donne quatre choix distincts dont la bonne réponse', () => {
  const [q] = composerQuiz({ complets, seance: [complets[0]!.id], progres: {}, maintenant, alea });
  expect(q?.choix).toHaveLength(4);
  expect(new Set(q?.choix.map((c) => c.id)).size).toBe(4);
  expect(q?.choix.some((c) => c.id === q.bonne)).toBe(true);
});
it('prend les mauvaises réponses dans le même genre quand il y en a assez', () => { /* 5 adjectifs, 5 verbes : pour un adjectif, tous les choix sont des adjectifs */ });
it('écarte les synonymes déclarés', () => { /* "Baguenauder" avec SYN: muser ; "Muser" de même genre n'apparaît jamais dans ses choix sur 50 tirages */ });
it('masque le mot dans sa définition', () => {
  expect(definitionPourQuiz(mot('Abracadabrantesque', 'adj.', '[Néol.] Qui ressemble à ce qui est abracadabrantesque.'))).toBe('Qui ressemble à ce qui est —.');
});
it('se compose avec peu de mots et ignore les mots disparus', () => {
  expect(composerQuiz({ complets: complets.slice(0, 2), seance: [complets[0]!.id, 'disparu'], progres: {}, maintenant, alea })[0]?.choix).toHaveLength(2);
  expect(composerQuiz({ complets: complets.slice(0, 1), seance: [complets[0]!.id], progres: {}, maintenant, alea })).toEqual([]);
});
```

- [ ] **Step 2:** `npm test`. Attendu : échec.
- [ ] **Step 3:** Écrire `quiz.ts`. `npm test` : tout passe.
- [ ] **Step 4:** Commit : `git commit -m "Composition du quiz"`.

### Task 8: Application web et écran Mot

**Files:**
- Create: `apps/web/package.json`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/svelte.config.js`
- Create: `apps/web/src/main.ts`, `App.svelte`, `app.css`, `etat.svelte.ts`, `stockage.ts`, `liste-embarquee.ts`
- Create: `apps/web/src/composants/Fiche.svelte`, `Onglets.svelte`, `Entete.svelte`
- Create: `apps/web/src/ecrans/Mot.svelte`
- Create: `packages/core/src/stockage.ts` et son test
- Modify: `package.json` (scripts `dev`, `build`, `check`)

**Interfaces:**
- Consumes: tout `@jolis-mots/core`.
- Produces:

```ts
// packages/core/src/stockage.ts
export function lireJson<T>(texte: string | null, defaut: T): T; // rend defaut si null ou illisible
// apps/web/src/stockage.ts
export const CLES = { progres: 'jolismots.progres.v1', favoris: 'jolismots.favoris.v1', reglages: 'jolismots.reglages.v1', liste: 'jolismots.liste.v1' };
export function lire<T>(cle: string, defaut: T): T;   // jamais d'exception
export function ecrire(cle: string, valeur: unknown): void; // jamais d'exception
// apps/web/src/etat.svelte.ts
export type Ecran = 'mot' | 'quiz' | 'recueil' | 'reglages';
export type Palette = 'systeme' | 'papier' | 'nuit' | 'ivoire' | 'ceruleen';
export interface Reglages { motsParSeance: number; palette: Palette } // défaut { motsParSeance: 3, palette: 'systeme' }
export const etat: {
  liste: FichierMots; progres: Progres; favoris: string[]; reglages: Reglages;
  seance: string[]; position: number; ecran: Ecran; ficheOuverte: string | null;
  readonly complets: Mot[]; readonly motCourant: Mot | null; readonly seanceFinie: boolean;
  suivant(): void; precedent(): void; basculerFavori(id: string): void;
  repondre(id: string, juste: boolean): void; allerA(e: Ecran): void; reglerPalette(p: Palette): void; reglerSeance(n: number): void;
  nouvelleSeance(): void;   // vide la séance, tire un mot, ouvre l'écran Mot
  effacerProgres(): void;   // vide progrès et favoris, puis nouvelleSeance()
};
```

Comportement (conception, sections 5.1, 6.5 et 9) :

- `liste-embarquee.ts` importe `../../../donnees/mots.json`. Au démarrage, `etat.liste` est la liste gardée sous `CLES.liste` si elle est valide (`validerFichier`) et plus récente (`publie`) que l'embarquée ; sinon l'embarquée.
- Au démarrage, `seance` est vide ; `suivant()` est appelé une fois pour afficher le premier mot. `suivant()` ajoute à `seance` le résultat de `prochainMot`, appelle `marquerVu` et enregistre les progrès. `precedent()` recule dans `seance`. `seanceFinie` est vrai quand `seance` compte au moins `motsParSeance` mots et que `position` est sur le dernier.
- `app.css` : `@fontsource/eb-garamond` (400, 500, 600, italiques 400 et 500), les quatre palettes en variables sur `:root[data-palette="…"]`, valeurs de la section 9 de la conception. `systeme` applique Papier, ou Nuit sous `prefers-color-scheme: dark`.
- `Fiche.svelte` (propriété `mot: Mot`) reproduit `Main.dc.html` : genre développé, mot à la taille `tailleDuMot` avec `overflow-wrap: anywhere`, trait d'accent, puis pour chaque sens de `lireDefinition` : numéro, indication développée en petites capitales, texte, usages, synonymes et antonymes précédés de leur intitulé, exemples en italique entre guillemets ; enfin « Rencontré chez » avec les sources (auteur, titre en italique, pages), absent si le mot n'a pas de source. Tout texte passe par `embellir`.
- `Mot.svelte` : la fiche défile, les boutons restent en bas. Étoile (favori, `aria-pressed`), bouton « Mot suivant ». Quand `seanceFinie` : le bouton principal devient « Passer au quiz » (ouvre l'écran Quiz) et un bouton secondaire « Encore un mot » appelle `suivant()`. Glissement horizontal de plus de 60 px : vers la gauche `suivant()`, vers la droite `precedent()`. Sans aucun mot complet : le texte « Aucun mot à lire pour l'instant. » et rien d'autre.
- `Onglets.svelte` : Mot, Quiz, Recueil, comme sur la maquette. `Entete.svelte` : « Jolis Mots » à gauche, position dans la séance (« 2 sur 3 ») et accès aux réglages à droite.
- L'adresse peut imposer l'état de départ, pour les essais et les captures : `#quiz`, `#recueil`, `#reglages` pour l'écran ; `?palette=nuit` pour la palette, sans l'enregistrer ; `?mot=ceruleen` pour le premier mot, comparé au `tri` normalisé.
- `vite.config.ts` : plugins `svelte()` et `appVersion()`, `base: './'`, `server.fs.allow` élargi à la racine du dépôt, `optimizeDeps.exclude: ['@jolis-mots/core']`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// packages/core/src/stockage.test.ts
it('rend la valeur par défaut quand le texte est absent ou illisible', () => {
  expect(lireJson(null, { a: 1 })).toEqual({ a: 1 });
  expect(lireJson('{"a":', { a: 1 })).toEqual({ a: 1 });
  expect(lireJson('{"a":2}', { a: 1 })).toEqual({ a: 2 });
});
```

- [ ] **Step 2:** `npm test` : échec. Écrire `lireJson`, relancer : tout passe.
- [ ] **Step 3:** Écrire l'application selon le comportement ci-dessus. `apps/web/src/stockage.ts` entoure chaque accès à `localStorage` d'un `try/catch`.
- [ ] **Step 4:** `npm run check` (svelte-check) et `npm run build`. Attendu : aucune erreur, `apps/web/dist/index.html` créé.
- [ ] **Step 5:** Vérifier à l'écran, `npm run dev` ouvert à 390 × 844 :
  - un mot s'affiche sans aucun clic ; « Mot suivant » en montre un autre ; au troisième, « Passer au quiz » et « Encore un mot » apparaissent ;
  - `?mot=abracadabrantesque` (mot long) et `?mot=ambage` (« Sans ambages », expression) : aucun débordement horizontal ;
  - `?palette=nuit`, `ivoire`, `ceruleen` changent les couleurs ;
  - dans la console, `localStorage.setItem('jolismots.progres.v1', '{')` puis recharger : l'application démarre normalement.
- [ ] **Step 6:** Commit : `git commit -m "Application web et écran Mot"`.

### Task 9: Écran Recueil

**Files:**
- Create: `apps/web/src/ecrans/Recueil.svelte`
- Modify: `apps/web/src/App.svelte`

**Interfaces:**
- Consumes: `etat`, `ordonner`, `filtrer`, `lettrine`, `auteursParNombre`, `developperGenre`, `lireDefinition`, `Fiche.svelte`.

Comportement (conception, section 5.3 ; maquette `Recueil.dc.html`) :

- En-tête : « Recueil » et le nombre de mots affichés (« 1 156 mots », avec espace fine insécable entre les milliers).
- Champ de recherche avec libellé accessible « Chercher un mot ».
- Filtres : Tous, Bouvier (`Nicolas Bouvier`), Tesson (`Sylvain Tesson`), Favoris, Autres auteurs. Ce dernier ouvre la liste de `auteursParNombre`, avec le nombre de mots de chacun ; en choisir un l'applique comme filtre.
- Liste ordonnée par `ordonner`, une lettrine à chaque changement de `lettrine`. Chaque ligne : le mot, une étoile s'il est favori, le genre développé, et sur une ligne tronquée le `texte` du premier sens.
- Toucher une ligne met `etat.ficheOuverte` à l'identifiant du mot : la fiche s'affiche en plein écran avec l'étoile et un bouton « Retour au recueil », qui rend la liste à sa position de défilement.
- La liste reste fluide avec 1 200 lignes : n'afficher que les lignes proches de la zone visible, ou vérifier que le défilement reste fluide sans cela.
- Aucun résultat : « Aucun mot ne correspond. »

- [ ] **Step 1:** Écrire l'écran et le relier dans `App.svelte`.
- [ ] **Step 2:** `npm run check` et `npm run build`. Attendu : aucune erreur.
- [ ] **Step 3:** Vérifier à l'écran, à 390 × 844, sur `#recueil` : taper « ecr » trouve « Écrin » ; le filtre Bouvier réduit le compteur ; une fiche s'ouvre et le retour rend la même position ; marquer un favori puis filtrer sur Favoris le montre.
- [ ] **Step 4:** Commit : `git commit -m "Écran Recueil"`.

### Task 10: Écran Quiz

**Files:**
- Create: `apps/web/src/ecrans/Quiz.svelte`
- Modify: `apps/web/src/App.svelte`

**Interfaces:**
- Consumes: `etat`, `composerQuiz`, `Question`, `developperGenre`, `embellir`.

Comportement (conception, section 5.2 ; maquette `Quiz.dc.html`) :

- À l'ouverture de l'écran, le quiz est composé une fois avec `composerQuiz({ complets: etat.complets, seance: etat.seance, progres: etat.progres, maintenant: new Date(), alea: Math.random })`.
- En-tête : « Quiz » et « Question 2 sur 3 » ; une barre de segments montre l'avancement.
- `definition-vers-mot` : intitulé « Quel mot correspond à cette définition ? », l'énoncé en grand, le genre développé dessous. `mot-vers-definition` : intitulé « Que veut dire ce mot ? », le mot en grand, les définitions en choix sur plusieurs lignes.
- Après un choix : la bonne réponse passe en fond d'encre avec une coche, le mauvais choix est barré avec une croix, les autres sont estompés ; les boutons ne répondent plus. `etat.repondre(idMot, juste)` est appelé une fois.
- Message : « Juste. » ou « C'était *mot*. », puis un bouton « Question suivante ». Aucun score.
- Après la dernière question : « C'est tout pour cette fois. », le nombre de mots revus, et un bouton « Lire d'autres mots » qui vide la séance, tire un nouveau mot et ouvre l'écran Mot.
- Quiz vide : « Rien à réviser aujourd'hui. » et le même bouton « Lire d'autres mots ».

- [ ] **Step 1:** Écrire l'écran et le relier dans `App.svelte`.
- [ ] **Step 2:** `npm run check` et `npm run build`. Attendu : aucune erreur.
- [ ] **Step 3:** Vérifier à l'écran, à 390 × 844 : lire trois mots, passer au quiz, répondre juste puis faux ; contrôler dans `localStorage` que la case du mot juste est 2 et celle du mot raté 1 ; ouvrir `#quiz` avec des progrès vides affiche « Rien à réviser aujourd'hui. ».
- [ ] **Step 4:** Commit : `git commit -m "Écran Quiz"`.

### Task 11: Réglages et mise à jour de la liste

**Files:**
- Create: `apps/web/src/ecrans/Reglages.svelte`, `apps/web/src/miseAJour.ts`
- Create: `packages/core/src/miseAJour.ts` et son test
- Modify: `apps/web/src/etat.svelte.ts`, `apps/web/src/main.ts`, `apps/web/src/App.svelte`

**Interfaces:**
- Produces:

```ts
// packages/core/src/miseAJour.ts
export const ADRESSE_LISTE: string; // l'adresse des Global Constraints
export function choisirListe(actuelle: FichierMots, recue: unknown): FichierMots; // la reçue si elle est valide et plus récente, sinon l'actuelle
// apps/web/src/miseAJour.ts
export async function rafraichir(): Promise<void>; // ne lève jamais d'exception
```

Comportement (conception, sections 5.5 et 7) :

- `rafraichir` est lancé au démarrage, sans attendre : `fetch(ADRESSE_LISTE, { cache: 'no-store' })` avec abandon après 8 secondes. Si `choisirListe` rend une liste différente de l'actuelle, elle est enregistrée sous `CLES.liste` et gardée en attente ; `etat.suivant()` l'adopte avant de tirer le mot suivant. Toute erreur est avalée en silence.
- `Reglages.svelte`, ouvert depuis l'en-tête : mots par séance (2 à 5), palette (Comme le système, Papier, Nuit, Ivoire, Céruléen, chacune avec un échantillon de ses couleurs), version (`__APP_VERSION__`), date de la liste (`publie`, au format « 24 novembre 2026 »), et « Effacer mes progrès » qui demande confirmation puis vide progrès et favoris.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
const liste = (publie: string): FichierMots => ({ format: 1, publie, mots: [] });
it('adopte une liste valide plus récente', () => {
  expect(choisirListe(liste('2026-01-01T00:00:00Z'), liste('2026-02-01T00:00:00Z')).publie).toBe('2026-02-01T00:00:00Z');
});
it.each([[liste('2025-12-01T00:00:00Z')], ['<html>Not Found</html>'], [null], [{ format: 1, publie: '2027-01-01T00:00:00Z' }], [{ format: 1, publie: '2027-01-01T00:00:00Z', mots: [{ id: 1 }] }]])(
  'garde la liste en place devant %j', (recue) => expect(choisirListe(liste('2026-01-01T00:00:00Z'), recue).publie).toBe('2026-01-01T00:00:00Z'),
);
```

- [ ] **Step 2:** `npm test` : échec. Écrire `miseAJour.ts` du cœur : tout passe.
- [ ] **Step 3:** Écrire `apps/web/src/miseAJour.ts`, l'écran Réglages, et l'adoption de la liste en attente dans `etat.suivant()`.
- [ ] **Step 4:** `npm run check`, `npm test`, `npm run build`. Attendu : aucune erreur.
- [ ] **Step 5:** Vérifier à l'écran : l'onglet Réseau montre une requête vers `raw.githubusercontent.com` qui répond 200 ; en coupant le réseau puis en rechargeant, l'application démarre et aucun message d'erreur n'apparaît ; changer la palette dans les réglages survit à un rechargement ; « Effacer mes progrès » vide `jolismots.progres.v1`.
- [ ] **Step 6:** Commit : `git commit -m "Réglages et mise à jour de la liste en ligne"`.

### Task 12: Application Android

**Files:**
- Create: `apps/android/package.json`, `apps/android/capacitor.config.ts`, `apps/android/build-apk.mjs`, `apps/android/make-icons.mjs`, `apps/android/assets/icone.svg`
- Modify: `package.json` (scripts `build:android`, `package:android`), `apps/web/src/main.ts` (bouton retour)

**Interfaces:**
- Consumes: `apps/web/dist` produit par `npm run build`.

Détails :

- Reprendre `..\Capitales\Claude\apps\android\` : mêmes versions de Capacitor (8.5.0), même `build-apk.mjs` (recherche d'un JDK entre 17 et 24, SDK dans `C:\Android\Sdk`), même `make-icons.mjs`. Lire la section 14 du `PROJECT.md` de Capitales avant de commencer.
- `capacitor.config.ts` : `appId: 'ch.noth.jolismots'`, `appName: 'Jolis Mots'`, `webDir: '../web/dist'`, `android.backgroundColor: '#F3F4EF'`, `server.androidScheme: 'https'`.
- L'APK porte le nom `Jolis-Mots-<version>.apk` dans `apps/android/release/`.
- Icône : sur fond papier `#F3F4EF`, les lettres « jm » en EB Garamond italique, encre `#1A2230`, soulignées d'un trait vermillon `#B8321E`. La montrer à Philippe avant de fabriquer l'APK.
- Bouton retour d'Android (`@capacitor/app`, événement `backButton`) : ferme la fiche ouverte ou les réglages ; sinon revient à l'écran Mot ; sur l'écran Mot, quitte l'application.
- La permission `INTERNET` ajoutée par Capacitor est gardée : la mise à jour de la liste en a besoin.

- [ ] **Step 1:** Vérifier le JDK : `ls "C:\Program Files\Eclipse Adoptium"`. S'il n'y a pas de JDK entre 17 et 24, demander à Philippe l'accord d'exécuter `winget install EclipseAdoptium.Temurin.21.JDK`, et ne l'exécuter qu'après son oui.
- [ ] **Step 2:** Écrire les fichiers, `npm install`, puis dans `apps/android` : `npx cap add android`.
- [ ] **Step 3:** `npm run package:android`. Attendu : `apps/android/release/Jolis-Mots-0.1.0.apk` existe.
- [ ] **Step 4:** Vérifier le paquet : `"C:\Android\Sdk\build-tools\36.0.0\aapt.exe" dump badging "apps/android/release/Jolis-Mots-0.1.0.apk"`. Attendu : `package: name='ch.noth.jolismots'`, `versionName='0.1.0'`, `application-label:'Jolis Mots'`.
- [ ] **Step 5:** Remettre l'APK à Philippe pour installation sur son téléphone et attendre son retour : un mot s'affiche à l'ouverture, le mode avion n'empêche rien, le bouton retour se comporte comme décrit.
- [ ] **Step 6:** Commit : `git commit -m "Application Android"`.

### Task 13: Documentation et version 0.1.0

**Files:**
- Create: `PROJET.md`, `scripts/captures.mjs`, `docs/captures/mot.png`, `quiz.png`, `recueil.png`, `reglages.png`, `palettes.png`
- Modify: `README.md`, `CHANGELOG.md`, `CLAUDE.md`
- Delete: `docs/captures/maquette-palettes.png`

Détails :

- `scripts/captures.mjs` lance `npm run build`, sert `apps/web/dist` sur un port local, puis appelle Edge sans fenêtre (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe --headless=new --hide-scrollbars --window-size=390,844 --screenshot=<fichier> <adresse>`) pour chaque capture : `?mot=ceruleen`, `#quiz`, `#recueil`, `#reglages`, et les quatre palettes de l'écran Mot assemblées côte à côte avec sharp dans `palettes.png`.
- `README.md` : retirer l'encadré « en construction », remplacer la maquette par les captures réelles, ajouter « Installer » (télécharger l'APK depuis la page des versions, autoriser l'installation), « Utiliser » (les trois écrans, les réglages), et mettre à jour « Détails techniques » et « Structure du dépôt » d'après le code réel. Dire que la version Windows et l'atelier viendront avec la version 1.0.0.
- `PROJET.md` : architecture (cœur, application web, Android), format de `mots.json`, conventions de définition et leur lecture, mémoire et quiz, mise à jour en ligne et branche `donnees`, import depuis l'Excel, commandes (`npm test`, `npm run dev`, `npm run import`, `npm run package:android`), exigence du JDK. Écrire seulement ce que le code montre.
- `CHANGELOG.md` : section `## [0.1.0] - <date>` avec, sous `Ajouté`, en phrases simples pour l'utilisateur : l'écran Mot, le quiz et sa mémoire, le recueil, les quatre palettes, la mise à jour de la liste en ligne. Ligne de lien en bas du fichier. Retirer la phrase « Aucune version n'est encore publiée ».

- [ ] **Step 1:** Écrire `scripts/captures.mjs`, le lancer, et regarder chaque image produite.
- [ ] **Step 2:** Écrire `PROJET.md`, mettre à jour `README.md`, `CHANGELOG.md` et `CLAUDE.md` (ajouter les commandes).
- [ ] **Step 3:** `npm test`, `npm run check`, `npm run build`. Attendu : tout passe.
- [ ] **Step 4:** Commit : `git commit -m "Documentation et notes de la version 0.1.0"`.
- [ ] **Step 5:** Envoyer la branche et ouvrir la demande de fusion (étape 4 de `VERSIONING.md`), avec la section 0.1.0 du journal comme texte. Donner le lien à Philippe.
- [ ] **Step 6:** Quand Philippe dit « publie » : étapes 5 à 7 de `VERSIONING.md` (fusion par commit de fusion, étiquette `v0.1.0`, publication), puis `gh release upload v0.1.0 "apps/android/release/Jolis-Mots-0.1.0.apk"`.
