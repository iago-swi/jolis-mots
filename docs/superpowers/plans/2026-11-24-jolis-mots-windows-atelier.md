# Jolis Mots, plan 2 : la version Windows et l'atelier

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la version 1.0.0 : l'application Windows avec son atelier (ajouter, modifier, supprimer des mots, puis « Envoyer au téléphone »), le quiz au choix et les filtres sur une ligne demandés par Philippe, et les points laissés ouverts par la 0.1.0.

**Architecture:** L'application web reste unique : elle se sait « sur bureau » quand Electron lui fournit un pont (`window.jolisMots`), et montre alors l'onglet Atelier. La logique de l'atelier (tri proposé, doublons, compteur, contrôle avant envoi) vit dans `packages/core`, sans interface, testée. Le processus principal d'Electron tient une copie `git` de la branche `donnees` dans le dossier de données de l'application et fait seul les opérations `git`. L'application Android garde son enveloppe Capacitor, signée désormais avec une clé propre.

**Tech Stack:** celui de la 0.1.0 (TypeScript ^7.0.2, Svelte ^5.56.10, Vite ^8.2.2, Vitest ^4.1.11, Capacitor 8.6.2), plus Electron 45.4.1 (version exacte), electron-builder ^26.18.0, esbuild ^0.25.0, png-to-ico ^3.0.2, happy-dom (dernière version publiée, pour un seul test). Le `git` du système (2.56 sur cette machine).

**Spec:** `docs/superpowers/specs/2026-11-24-jolis-mots-design.md`, révisée pour la 1.0.0 : lire d'abord la section 13, puis les sections 5.1 à 5.5, 6.2 et 7. Maquette de l'atelier : `docs/superpowers/specs/maquette/Atelier.dc.html`. Modèle technique pour Electron : `..\Capitales\Claude\apps\desktop\` (`src/main.ts`, `build.mjs`, `package.json`).

## Global Constraints

- Tous les textes de l'application, les messages de commit, la documentation et les notes de version sont en français. L'application tutoie (« Tes modifications restent en attente »), dans le ton sobre de la maquette.
- **Le texte saisi fait référence.** Aucun traitement ne perd ni ne modifie un caractère de `definition`, `sources`, `genre`, `note` ou `util` dans les données enregistrées. Seuls `mot` et `tri` perdent leurs espaces de début et de fin (insécables comprises).
- **Aucune tâche n'envoie quoi que ce soit sur la branche `donnees` de GitHub.** Tous les essais de l'atelier utilisent un dépôt nu local, donné par la variable `JOLISMOTS_DEPOT`, et un dossier de données temporaire, donné par `JOLISMOTS_DONNEES`. Le premier vrai envoi est fait par Philippe.
- L'atelier n'écrase jamais la liste en ligne : ni `git push --force`, ni réécriture d'historique. L'application ne manipule ni mot de passe ni jeton ; `git` est appelé par `execFile`, jamais par un shell.
- `vocabulaire.xlsx` n'est jamais ajouté au dépôt ni modifié. La branche `donnees` ne contient que `mots.json`.
- Un mot est **complet** quand `definition` n'est pas vide et que `aCompleter` est faux. Seuls les mots complets apparaissent dans Mot, Quiz et Recueil ; l'atelier les montre tous.
- Une seule police, EB Garamond. Aucune couleur en dur dans un composant : uniquement `--papier`, `--encre`, `--second`, `--filet`, `--exemple`, `--accent`. Les quatre palettes s'appliquent à l'atelier. Contraste d'au moins 4,5 pour 1. Zones tactiles d'au moins 44 px sur le téléphone. Aucun mouvement si `prefers-reduced-motion: reduce`.
- Pas d'habillage de jeu : ni score, ni points, ni série.
- Identifiant de l'application : `ch.noth.jolismots`. Nom affiché : `Jolis Mots`. Dépôt : `https://github.com/iago-swi/jolis-mots.git`, branche des mots `donnees`.
- Tout le travail se fait sur la branche `release/jolis-mots-v1.0.0`. Rien n'est validé sur `main`. Le premier commit de la branche porte la conception révisée et ce plan (« Conception révisée pour la 1.0.0 et plan 2 »). Un commit par tâche, sous l'identité Git de Philippe, message simple en français, sans ligne d'attribution. Suivre `VERSIONING.md`. Rien n'est fusionné ni étiqueté avant que Philippe dise « publie ».
- Sur cette machine : chemins avec espaces et tirets demi-cadratin, toujours entre guillemets ; Gradle se lance depuis PowerShell, jamais depuis Git Bash ; l'émulateur `Pixel_8` a une WebView ancienne (133).
- Après chaque tâche : `npm test` et `npm run check` passent.

## Review Focus

1. **Texte collé du CNRTL dans une définition** (espaces insécables et fines, tabulations, guillemets, barres obliques inverses, séparateur U+2028, émoji, lignes vides en fin) : ce qui est enregistré puis relu est identique au caractère près, et le fichier écrit par l'atelier est de l'UTF-8 sans BOM avec des fins de ligne `\n`. Tâches 11 et 12.
2. **Envoi coupé en route** (réseau absent, refus de GitHub, puis nouvel essai, puis redémarrage) : rien n'est perdu, le compteur reste juste, et l'essai suivant n'ajoute qu'une seule version en ligne. Tâche 12.
3. **Liste en ligne changée ailleurs alors que des modifications attendent** : rien n'est envoyé ni écrasé, la version locale est mise de côté dans un fichier daté avant toute reprise. Tâche 12.
4. **Mot supprimé, renommé ou redevenu « à compléter » alors qu'il est affiché ailleurs** (mot courant de l'écran Mot, fiche ouverte du Recueil, favori, progrès) : aucune fiche vide, aucun arrêt ; l'identifiant ne change jamais. Tâches 5 et 13.
5. **Copie locale abîmée** (`mots.json` illisible ou retouché à la main, dossier créé par un téléchargement interrompu, `git` absent) : l'atelier dit ce qui ne va pas et propose une issue, les écrans de lecture montrent la liste embarquée, et aucun fichier illisible n'est écrasé sans copie. Tâches 12 et 13.

## Carte des fichiers

| Fichier | Rôle | Tâche |
| --- | --- | --- |
| `packages/core/src/fichier.ts`, `miseAJour.ts` | identifiants contrôlés, liste vide refusée | 1 |
| `packages/core/src/definition.ts`, `quiz.ts` ; `apps/web/src/composants/Fiche.svelte` | chapeau, longues indications | 2 |
| `packages/core/src/memoire.ts`, `selection.ts`, `hasard.ts` (nouveau) | règles de mémoire | 3 |
| `packages/core/src/quiz.ts` | quiz au choix | 4 |
| `apps/web/src/etat.svelte.ts`, `vitest.config.ts` | état sans séance, liste remplaçable | 5 |
| `apps/web/src/ecrans/Mot.svelte`, `Quiz.svelte`, `Reglages.svelte`, `App.svelte`, `composants/Entete.svelte` | écrans du téléphone | 6 |
| `apps/web/src/ecrans/Recueil.svelte`, `apps/web/src/volet.ts` (nouveau) | filtres, volets au clavier | 7 |
| `apps/android/ajuster-projet.mjs` (nouveau), `apps/web/index.html`, `apps/web/src/main.ts` | portrait, lancement sans éclair | 8 |
| `apps/android/build-apk.mjs` | signature | 9 |
| `packages/core/src/atelier.ts` (nouveau) | liste et fiche de l'atelier | 10 |
| `packages/core/src/envoi.ts` (nouveau) | compteur, message, contrôle | 11 |
| `packages/core/src/pont.ts` (nouveau), `apps/desktop/src/depot.ts` (nouveau) | contrat du pont, opérations `git` | 12 |
| `apps/web/src/pont.ts`, `pont-demo.ts`, `atelier.svelte.ts` (nouveaux), `main.ts`, `composants/Onglets.svelte` | l'application sur bureau | 13 |
| `apps/web/src/ecrans/Atelier.svelte`, `composants/atelier/*.svelte` (nouveaux) | écran Atelier | 14, 15 |
| `apps/desktop/` : `package.json`, `build.mjs`, `make-icons.mjs`, `src/main.ts`, `src/preload.ts` | enveloppe Electron | 16 |
| `scripts/maj-donnees.mjs` (nouveau), `tools/import/importer.ts`, `package.json` | paquets, données fraîches, import gardé | 17 |
| `README.md`, `PROJET.md`, `CHANGELOG.md`, `VERSIONING.md`, `CLAUDE.md`, `scripts/captures.mjs` | documentation, version | 18 |

---

## Première partie : le cœur et le téléphone

### Task 1: Une liste sûre

**Files:**
- Modify: `packages/core/src/fichier.ts`, `packages/core/src/miseAJour.ts`
- Test: `packages/core/src/fichier.test.ts`, `packages/core/src/miseAJour.test.ts`

**Interfaces:**
- Produces:

```ts
// fichier.ts
export function validerFichier(x: unknown): FichierMots | null; // rend aussi null si un identifiant est vide ou porté par deux mots
export function creerIdUnique(pris: Iterable<string>, tirer?: () => string): string; // `tirer` vaut `creerId` par défaut
// miseAJour.ts : `choisirListe` garde `actuelle` quand la liste reçue n'a aucun mot
```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// fichier.test.ts — `a` et `b` sont deux mots valides d'identifiants différents
expect(validerFichier({ format: 1, publie: '2026-11-24T10:00:00Z', mots: [a, { ...b, id: a.id }] })).toBeNull();
expect(validerFichier({ format: 1, publie: '2026-11-24T10:00:00Z', mots: [{ ...a, id: '' }] })).toBeNull();
expect(validerFichier({ format: 1, publie: '2026-11-24T10:00:00Z', mots: [{ ...a, id: '  ' }] })).toBeNull();
expect(validerFichier({ format: 1, publie: '', mots: [] })).not.toBeNull(); // une liste vide garde la bonne forme
const tirages = ['aaaaaa', 'aaaaaa', 'bbbbbb'];
expect(creerIdUnique(new Set(['aaaaaa']), () => tirages.shift()!)).toBe('bbbbbb');

// miseAJour.test.ts
expect(choisirListe(actuelle, { format: 1, publie: '2999-01-01T00:00:00Z', mots: [] })).toBe(actuelle);
```

- [ ] **Step 2: Les lancer** — `npx vitest run packages/core/src/fichier.test.ts packages/core/src/miseAJour.test.ts` ; attendu : échec sur les cas nouveaux.
- [ ] **Step 3: Écrire le code** aux signatures ci-dessus.
- [ ] **Step 4: Relancer** — attendu : tout passe, les tests existants aussi.
- [ ] **Step 5: Commit** — `git commit -m "Liste : identifiants contrôlés, liste vide refusée"`

### Task 2: Définitions : chapeau et longues indications

**Files:**
- Modify: `packages/core/src/definition.ts`, `packages/core/src/quiz.ts` (`definitionPourQuiz` seulement), `apps/web/src/composants/Fiche.svelte`
- Test: `packages/core/src/definition.test.ts`, `packages/core/src/quiz.test.ts`

**Interfaces:**
- Produces:

```ts
// definition.ts
export const INDICATION_LONGUE = 30;
export function indicationEstLongue(indication: string): boolean; // plus de 30 caractères
// lireDefinition : du texte placé avant le `1.` devient un premier Sens sans numéro (le chapeau), lu comme un sens ordinaire.
// La règle existante de la ligne faite d'une seule indication entre crochets (« [Argot] ») ne change pas.
// quiz.ts — definitionPourQuiz : s'il existe des sens numérotés, le texte vient du premier d'entre eux qui en a un.
```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
const eployer = "Synon. littér. de déployer.\n1. [En parlant des ailes d'un oiseau] Étendre ce qui est replié. EX: Le vautour éploie ses ailes.\n2. S'étendre, s'ouvrir.";
const sens = lireDefinition(eployer);
expect(sens).toHaveLength(3);
expect(sens[0]).toMatchObject({ numero: null, indication: null, texte: 'Synon. littér. de déployer.' });
expect(sens[1]).toMatchObject({ numero: '1', indication: "En parlant des ailes d'un oiseau", texte: 'Étendre ce qui est replié.', exemples: ['Le vautour éploie ses ailes.'] });
expect(sens[2]).toMatchObject({ numero: '2', texte: "S'étendre, s'ouvrir." });
// un chapeau de deux lignes garde son retour à la ligne
expect(lireDefinition('Ligne une.\nLigne deux.\n1. Sens.')[0]?.texte).toBe('Ligne une.\nLigne deux.');
// la ligne d'indication seule reste l'indication du premier sens
expect(lireDefinition('[Argot]\n1. Blesser.')).toHaveLength(1);
expect(indicationEstLongue('Litt., rare')).toBe(false);
expect(indicationEstLongue('x'.repeat(30))).toBe(false);
expect(indicationEstLongue("En parlant des ailes d'un oiseau ou p. compar. explicite")).toBe(true);
// quiz.test.ts
expect(definitionPourQuiz({ ...motVide, mot: 'Éployer', tri: 'éployer', definition: eployer })).toBe('Étendre ce qui est replié.');
```

Ajouter `eployer` aux échantillons du test existant « ne perd aucun mot ».

- [ ] **Step 2: Les lancer** — attendu : échec.
- [ ] **Step 3: Écrire le code** dans `definition.ts` et `quiz.ts`.
- [ ] **Step 4: Adapter `Fiche.svelte`.** Une indication longue (`indicationEstLongue`) prend une classe `note` : italique, 17 px, couleur `--second`, sans capitales ni interlettrage, suivie d'une espace. Une indication courte garde la classe `intitule`. Plusieurs usages (`US:`) d'un même sens s'affichent chacun sur sa ligne (`join('\n')`, la classe `valeur` garde déjà les retours à la ligne).
- [ ] **Step 5: Vérifier** — `npm test` passe. `npm run dev`, puis `http://localhost:5173/?mot=eployer` à 390 px de large : le chapeau au-dessus de trois sens numérotés, les longues indications en italique courant. `?mot=baguenauder` est inchangé.
- [ ] **Step 6: Commit** — `git commit -m "Définitions : chapeau avant le premier sens, longues indications en italique"`

### Task 3: Mémoire : une bonne réponse ne compte que si le mot est dû

**Files:**
- Create: `packages/core/src/hasard.ts` (reçoit `melanger`, aujourd'hui privé dans `quiz.ts`)
- Modify: `packages/core/src/memoire.ts`, `packages/core/src/selection.ts`, `packages/core/src/quiz.ts` (import de `melanger`), `packages/core/src/index.ts`
- Test: `packages/core/src/memoire.test.ts`, `packages/core/src/selection.test.ts`

**Interfaces:**
- Produces:

```ts
// hasard.ts
export function melanger<T>(liste: readonly T[], alea: () => number): T[];
// memoire.ts — EtatMot.vu vaut '' pour un mot rencontré seulement dans un quiz
export function repondre(p: Progres, id: string, juste: boolean, maintenant: Date): Progres;
export function motsARevoir(p: Progres, maintenant: Date, alea: () => number): string[];
export function validerProgres(x: unknown): Progres;
// selection.ts — prochainMot compte comme jamais montré un mot absent des progrès ou dont `vu` vaut ''
```

Règles de `repondre` (conception, section 5.2) :

| Mot | Réponse | Effet |
| --- | --- | --- |
| inconnu | juste ou fausse | entre en case 1, `vu: ''`, dû un jour plus tard |
| connu | fausse | case 1, dû un jour plus tard, `acquis: false` |
| connu, dû (`!acquis && du <= maintenant`) | juste | monte d'une case ; en case 5, `acquis: true` |
| connu, pas encore dû, ou acquis | juste | rien : `repondre` rend `p` lui-même |

`motsARevoir` : les mots non acquis ; d'abord ceux qui sont dus, dans l'ordre de `motsDus`, puis les autres, mélangés avec `alea`. `validerProgres` : garde les entrées dont `vu` est une chaîne, `case` un entier de 1 à 5, `du` une date lisible et `acquis` un booléen ; écarte le reste ; rend `{}` pour tout ce qui n'est pas un objet simple.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
const J = (n: number) => new Date(Date.UTC(2026, 10, 24 + n));
// inconnu : entre en case 1 sans date de vue, quelle que soit la réponse
expect(repondre({}, 'a', true, J(0)).a).toEqual({ vu: '', case: 1, du: J(1).toISOString(), acquis: false });
expect(repondre({}, 'a', false, J(0)).a).toEqual({ vu: '', case: 1, du: J(1).toISOString(), acquis: false });
// pas encore dû : une bonne réponse ne change rien
const vu = marquerVu({}, 'a', J(0));
expect(repondre(vu, 'a', true, J(0))).toBe(vu);
// dû : monte en case 2, dû trois jours plus tard
expect(repondre(vu, 'a', true, J(1)).a).toMatchObject({ case: 2, du: J(4).toISOString() });
// faux, même pas dû : retour en case 1
const case3 = { a: { vu: J(0).toISOString(), case: 3 as const, du: J(9).toISOString(), acquis: false } };
expect(repondre(case3, 'a', false, J(1)).a).toMatchObject({ case: 1, du: J(2).toISOString(), acquis: false });
// acquis : juste ne change rien, faux le renvoie en case 1
const acquis = { a: { vu: J(0).toISOString(), case: 5 as const, du: J(0).toISOString(), acquis: true } };
expect(repondre(acquis, 'a', true, J(50))).toBe(acquis);
expect(repondre(acquis, 'a', false, J(50)).a).toMatchObject({ case: 1, acquis: false });
// motsARevoir : dus d'abord (le plus ancien en tête), puis les autres, jamais un acquis
// p : d1 dû J(-2), d2 dû J(-1), n1 et n2 dus J(5), q acquis
expect(motsARevoir(p, J(0), () => 0).slice(0, 2)).toEqual(['d1', 'd2']);
expect(new Set(motsARevoir(p, J(0), () => 0))).toEqual(new Set(['d1', 'd2', 'n1', 'n2']));
// validerProgres
expect(validerProgres({ x: 5, a: vu.a, b: { ...vu.a, case: 9 }, c: { ...vu.a, du: 'demain' } })).toEqual({ a: vu.a });
expect(validerProgres([1, 2])).toEqual({});
expect(validerProgres(null)).toEqual({});
// selection.test.ts : un mot rencontré seulement au quiz reste à lire
const quizSeul = repondre({}, 'm1', true, J(0));
expect(prochainMot([m1], quizSeul, [], () => 0)).toBe(m1); // traité comme un mot neuf, pas comme « le plus ancien »
// et, parmi les mots tous montrés, c'est bien le plus anciennement vu qui sort (m2 vu J(-3), m1 vu J(-1), dans cet ordre de liste : m1, m2)
expect(prochainMot([m1, m2], tousVus, [], () => 0)).toBe(m2);
```

- [ ] **Step 2: Les lancer** — attendu : échec.
- [ ] **Step 3: Écrire le code.** Les tests existants de `repondre` qui supposaient qu'une bonne réponse fait toujours monter sont réécrits pour un mot dû.
- [ ] **Step 4: Relancer** — attendu : tout passe.
- [ ] **Step 5: Commit** — `git commit -m "Mémoire : une bonne réponse ne fait monter qu'un mot dû"`

### Task 4: Le quiz au choix

**Files:**
- Modify: `packages/core/src/quiz.ts`, `apps/web/src/ecrans/Quiz.svelte` (l'appel à `composerQuiz` seulement)
- Test: `packages/core/src/quiz.test.ts`

**Interfaces:**
- Consumes: `motsARevoir`, `melanger` (tâche 3).
- Produces:

```ts
export type Portee = 'tous' | 'vus';
export const QUESTIONS_POSSIBLES: readonly number[] = [5, 10, 15, 20];
export const QUESTIONS_PAR_DEFAUT = 10;
export function compterPortees(complets: Mot[], progres: Progres): Record<Portee, number>;
export function composerQuiz(a: {
  complets: Mot[]; progres: Progres; portee: Portee; nombre: number; maintenant: Date; alea: () => number;
}): Question[];
```

`DUS_MAX` et le paramètre `seance` disparaissent. Un mot est **interrogeable** s'il est complet et que `definitionPourQuiz` n'est pas vide. `'tous'` : les interrogeables, mélangés. `'vus'` : `motsARevoir`, réduit aux interrogeables. Le quiz prend les `nombre` premiers mots pour lesquels il existe au moins une mauvaise réponse ; les formes alternent et les mauvaises réponses se tirent comme aujourd'hui. `compterPortees` : `tous` = nombre d'interrogeables ; `vus` = interrogeables présents dans les progrès et non acquis.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// 12 mots interrogeables m1…m12 ; progrès : m1 dû J(-2), m2 dû J(-1), m3 dû J(0), m4…m7 dus J(5), m8 acquis
const q = composerQuiz({ complets, progres, portee: 'vus', nombre: 5, maintenant: J(0), alea: () => 0 });
expect(q.map((x) => x.idMot).slice(0, 3)).toEqual(['m1', 'm2', 'm3']);
expect(q).toHaveLength(5);
expect(q.map((x) => x.idMot)).not.toContain('m8');
expect(q.every((x) => ['m1','m2','m3','m4','m5','m6','m7'].includes(x.idMot))).toBe(true);
// 'tous' : jamais deux fois le même mot, au plus ce que la liste contient
const tous = composerQuiz({ complets: complets.slice(0, 6), progres: {}, portee: 'tous', nombre: 10, maintenant: J(0), alea: Math.random });
expect(new Set(tous.map((x) => x.idMot)).size).toBe(tous.length);
expect(tous).toHaveLength(6);
// rien de vu : pas de quiz sur les mots vus
expect(composerQuiz({ complets, progres: {}, portee: 'vus', nombre: 10, maintenant: J(0), alea: () => 0 })).toEqual([]);
// un progrès qui cite un mot disparu de la liste est ignoré
expect(compterPortees(complets, { ...progres, fantome: progres.m1! })).toEqual({ tous: 12, vus: 7 });
// moins de quatre mots : le quiz se compose quand même, avec moins de choix
expect(composerQuiz({ complets: complets.slice(0, 2), progres: {}, portee: 'tous', nombre: 5, maintenant: J(0), alea: () => 0 })[0]?.choix).toHaveLength(2);
```

Les tests existants sur les mauvaises réponses (synonymes, homographes, même texte) sont gardés, portés sur la nouvelle signature.

- [ ] **Step 2: Les lancer** — attendu : échec (signature inconnue).
- [ ] **Step 3: Écrire le code.**
- [ ] **Step 4: Garder l'application debout.** Dans `Quiz.svelte`, l'appel devient `composerQuiz({ complets: etat.complets, progres: etat.progres, portee: 'tous', nombre: QUESTIONS_PAR_DEFAUT, maintenant: new Date(), alea: Math.random })` ; rien d'autre n'y change (l'écran du choix est la tâche 6). `npm test` et `npm run check` passent.
- [ ] **Step 5: Commit** — `git commit -m "Quiz : tous les mots ou les mots vus, au choix"`

### Task 5: L'état du téléphone, sans séance

**Files:**
- Modify: `apps/web/src/etat.svelte.ts`, `apps/web/src/ecrans/Quiz.svelte` et `Mot.svelte`, `Reglages.svelte`, `App.svelte` (le strict nécessaire pour compiler ; leur mise en forme est la tâche 6), `vitest.config.ts`
- Create: `apps/web/src/etat.test.ts`

**Interfaces:**
- Consumes: `composerQuiz`, `Portee`, `QUESTIONS_POSSIBLES`, `QUESTIONS_PAR_DEFAUT` (tâche 4), `validerProgres` (tâche 3).
- Produces (membres de la classe `Etat`) :

```ts
export interface Reglages { questionsParQuiz: number; palette: Palette }
lus: string[];                         // remplace `seance` : les mots montrés depuis l'ouverture
quizDemande: Portee | null;            // adresse de développement « ?quiz=tous » ou « ?quiz=vus »
reglerQuestions(n: number): void;      // remplace `reglerSeance` ; borne à QUESTIONS_POSSIBLES
reprendreLecture(): void;              // remplace `nouvelleSeance`
remplacerListe(l: FichierMots): void;  // adopte `l` tout de suite et remet l'état d'aplomb
```

Disparaissent : `seanceFinie`, `repondus`, `motsParSeance`, `SEANCES_POSSIBLES`. Un réglage enregistré par la 0.1.0 (`motsParSeance`) est ignoré : `questionsParQuiz` vaut alors 10. Les progrès lus au démarrage passent par `validerProgres`.

`remplacerListe` : pose la liste ; retire de `lus` les mots qui ne sont plus complets ; ramène `position` dans les bornes ; si `lus` est vide et qu'il reste des mots complets, tire un mot ; ferme `ficheOuverte` si son mot n'est plus complet. `adopterListeEnAttente` passe par elle. `proposerListe` adopte tout de suite la liste reçue quand la liste en place n'a aucun mot complet.

- [ ] **Step 1: Préparer Vitest.** Dans `vitest.config.ts`, ajouter le greffon Svelte (`@sveltejs/vite-plugin-svelte`, déjà installé) et la condition de résolution `browser`, pour que les fichiers `.svelte.ts` se compilent. Les tests existants passent toujours.
- [ ] **Step 2: Écrire les tests qui échouent** dans `etat.test.ts`. Chaque test remplace `./liste-embarquee` par une petite liste (`vi.mock`), pose un `localStorage` fait d'une `Map` sur `globalThis`, et charge un module neuf (`vi.resetModules()` puis `await import('./etat.svelte')`).

```ts
// 1. De bout en bout : la liste en ligne arrive, elle est gardée, puis adoptée au mot suivant
globalThis.fetch = async () => new Response(JSON.stringify(listePlusRecente));
etat.demarrer({ search: '', hash: '' });
await rafraichir();
expect(etat.liste.publie).toBe(embarquee.publie);
expect(JSON.parse(localStorage.getItem('jolismots.liste.v1')!).publie).toBe(listePlusRecente.publie);
etat.suivant();
expect(etat.liste.publie).toBe(listePlusRecente.publie);
// 2. Au lancement suivant (module neuf), la liste gardée est préférée à l'embarquée
// 3. Réponses inutilisables : 404, texte HTML, JSON tronqué, date plus ancienne, liste vide, fetch qui lève → rien ne change, rien n'est levé
// 4. Liste embarquée sans mot complet + liste reçue valide → adoptée tout de suite, etat.motCourant !== null
// 5. remplacerListe sans le mot courant (supprimé, ou passé « à compléter ») :
etat.remplacerListe({ ...embarquee, mots: embarquee.mots.filter((m) => m.id !== etat.motCourant!.id) });
expect(etat.motCourant).not.toBeNull();
expect(etat.lus.every((id) => etat.complets.some((m) => m.id === id))).toBe(true);
// 6. remplacerListe sans le mot de la fiche ouverte → etat.ficheOuverte === null
// 7. Progrès abîmés : localStorage progres = '{"x":5,"a1":{…valide}}' → l'état démarre, etat.progres n'a que a1
// 8. Réglages de la 0.1.0 : '{"motsParSeance":8,"palette":"nuit"}' → questionsParQuiz 10, palette 'nuit'
// 9. demarrer({ search: '?quiz=vus', hash: '#quiz' }) → etat.quizDemande === 'vus' ; une autre valeur → null
```

- [ ] **Step 3: Les lancer** — attendu : échec.
- [ ] **Step 4: Écrire le code** de l'état, et le strict nécessaire dans les écrans pour que `npm run check` passe (le Quiz garde `portee: 'tous'` et prend `nombre: etat.reglages.questionsParQuiz` en attendant la tâche 6).
- [ ] **Step 5: Relancer** — `npm test` et `npm run check` passent.
- [ ] **Step 6: Commit** — `git commit -m "État : plus de séance, liste remplaçable, progrès contrôlés"`

### Task 6: Les écrans Mot, Quiz et Réglages

**Files:**
- Modify: `apps/web/src/ecrans/Mot.svelte`, `Quiz.svelte`, `Reglages.svelte`, `apps/web/src/App.svelte`, `apps/web/src/composants/Entete.svelte`

**Interfaces:**
- Consumes: l'état de la tâche 5, `compterPortees` et `composerQuiz` de la tâche 4.

Ce qui change, écran par écran :

- **En-tête** : plus de « 2 sur 5 ».
- **Mot** : toujours « Mot suivant » ; « Encore un mot » et « Passer au quiz » disparaissent.
- **Quiz**, en trois temps :
  1. *Le choix.* Titre « Quiz », question « Sur quels mots ? », deux grands boutons avec leur nombre à droite (`compterPortees`, milliers séparés par une espace fine insécable) : « Tous les mots » et « Les mots que j'ai vus ». Sans mot vu, le second est inactif (`aria-disabled`) et suivi de « Lis d'abord quelques mots : ils viendront ici. ». Sans aucun mot interrogeable : « Aucun mot à réviser pour l'instant. ».
  2. *Les questions.* Comme aujourd'hui, composées une fois au moment du choix, avec `nombre: etat.reglages.questionsParQuiz`.
  3. *La fin.* « C'est tout pour cette fois. », « 10 mots revus. », puis « Encore un quiz » (retour au choix) et « Lire des mots » (écran Mot).
  - Le curseur du clavier va sur « Sur quels mots ? » à l'arrivée et au retour au choix, sur l'intitulé de la question après un choix.
  - `etat.quizDemande` saute le choix (pour les captures).
- **Réglages** : « Questions par quiz », pastilles 5, 10, 15, 20, à la place de « Mots par séance ».

- [ ] **Step 1: Écrire les écrans** selon la liste ci-dessus, avec les styles existants (boutons `principal` et `secondaire`, intitulés en petites capitales).
- [ ] **Step 2: Vérifier dans le navigateur**, à 390 × 844 px, palettes Papier et Nuit (`?palette=nuit`) : `#quiz` avec un stockage vide (second choix inactif et sa phrase) ; après trois « Mot suivant », le second choix affiche 4 ; un quiz « Tous les mots » va au bout et propose les deux boutons de fin ; `?quiz=vus&mot=baguenauder#quiz` pose directement la question de « baguenauder » ; au clavier seul (Tab, Entrée), tout le parcours est faisable et le curseur est toujours visible.
- [ ] **Step 3: Vérifier** — `npm test` et `npm run check` passent.
- [ ] **Step 4: Commit** — `git commit -m "Écrans : lecture sans fin, quiz au choix, questions par quiz"`

### Task 7: Recueil : filtres sur une ligne, volets au clavier

**Files:**
- Create: `apps/web/src/volet.ts`, `apps/web/src/volet.test.ts`
- Modify: `apps/web/src/ecrans/Recueil.svelte`, `apps/web/src/ecrans/Reglages.svelte`, `packages/core/src/sources.ts`, `packages/core/src/sources.test.ts`, `scripts/captures.mjs`, `package.json` (dépendance de développement `happy-dom`)

**Interfaces:**
- Produces:

```ts
// packages/core/src/sources.ts
export function nomCourt(auteur: string): string; // le dernier mot : « Nicolas Bouvier » → « Bouvier »
// apps/web/src/volet.ts — action Svelte pour un volet ou une confirmation
export function volet(noeud: HTMLElement, options: { fermer: () => void }): { destroy(): void };
```

`volet` : à la pose, retient l'élément qui avait le curseur et place le curseur sur le premier descendant marqué `data-depart`, sinon sur le nœud lui-même (`tabindex="-1"`) ; la touche Échap appelle `fermer` ; au retrait, rend le curseur à l'élément retenu s'il est encore dans la page.

**Filtres** (conception, section 5.3) : dans l'ordre, Bouvier, Tesson, Rollin, Méral, Favoris, Autres. Les quatre auteurs sont `Nicolas Bouvier`, `Sylvain Tesson`, `François Rollin`, `Didier Méral`. Pas de bouton « Tous » : toucher le filtre allumé l'éteint. « Autres » ouvre le volet des auteurs, privé des quatre premiers ; quand un autre auteur est choisi, le bouton porte son `nomCourt` et reste allumé.

Mise en forme : une seule ligne, sans retour (`flex-wrap: nowrap`) ; boutons plus petits (texte de 15 px, hauteur visible de 32 px, marges intérieures réduites) dont la zone tactile garde 44 px de haut. La ligne doit tenir dans un écran de 411 px de large sans défilement. **Si elle ne tient pas avec « Favoris » en toutes lettres, Favoris devient l'étoile de l'écran Mot** (`aria-label="Favoris"`) ; c'est la seule variante permise. Sur un écran plus étroit, la ligne défile horizontalement plutôt que de passer sur deux lignes.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// sources.test.ts
expect(nomCourt('Nicolas Bouvier')).toBe('Bouvier');
expect(nomCourt('Anne Marie Jaton')).toBe('Jaton');
expect(nomCourt('Homère')).toBe('Homère');
// volet.test.ts — première ligne du fichier : // @vitest-environment happy-dom
// la page a un bouton « ouvreur » qui a le curseur, puis un volet contenant un bouton marqué data-depart
const action = volet(noeud, { fermer });
expect(document.activeElement).toBe(depart);
noeud.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
expect(fermer).toHaveBeenCalledTimes(1);
action.destroy();
expect(document.activeElement).toBe(ouvreur);
// sans data-depart : le curseur va sur le volet lui-même
// si l'ouvreur a quitté la page avant destroy : rien n'est levé
```

- [ ] **Step 2: Les lancer** — attendu : échec.
- [ ] **Step 3: Écrire `nomCourt` et `volet`.**
- [ ] **Step 4: Refaire les filtres** de `Recueil.svelte` selon la description, et poser `use:volet` sur le volet de la fiche et sur celui des auteurs (`role="dialog"`, `aria-modal="true"`), ainsi que sur la confirmation « Effacer mes progrès » de `Reglages.svelte`. Le retour du curseur fait par `volet` remplace le `querySelector('[data-id=…]')` de `Recueil.svelte`.
- [ ] **Step 5: Ajouter le contrôle de largeur à `scripts/captures.mjs`.** Avant les photos : écran émulé de 411 × 900 px, page `#recueil`, puis évaluer `document.querySelector('.filtres')` ; si `scrollWidth > clientWidth` ou si un bouton n'est pas sur la même ligne que le premier, le script s'arrête avec « Les filtres du Recueil ne tiennent pas sur une ligne à 411 px. ».
- [ ] **Step 6: Vérifier** — `npm test` et `npm run check` passent ; `npm run captures` passe le contrôle. Dans le navigateur à 411 px : chaque filtre s'allume puis s'éteint au second toucher ; Autres → un auteur → le bouton porte son nom court ; au clavier, ouvrir une fiche puis Échap ramène le curseur sur la ligne du mot, et de même pour le volet des auteurs et la confirmation des Réglages. Dire dans le compte rendu si Favoris est en toutes lettres ou en étoile, et la largeur mesurée de la ligne.
- [ ] **Step 7: Commit** — `git commit -m "Recueil : filtres sur une ligne, volets utilisables au clavier"`

### Task 8: Android : portrait, lancement sans éclair

**Files:**
- Create: `apps/android/ajuster-projet.mjs`
- Modify: `apps/android/package.json` (script `sync`), `apps/web/index.html`, `apps/web/src/main.ts`, au besoin `apps/android/capacitor.config.ts` et `apps/android/make-icons.mjs`

- [ ] **Step 1: Portrait.** `ajuster-projet.mjs` ajoute `android:screenOrientation="portrait"` à l'activité principale de `android/app/src/main/AndroidManifest.xml`, sans le poser deux fois, et s'arrête avec un message clair si le dossier `android/` manque. Le script `sync` devient `cap sync android && node make-icons.mjs && node ajuster-projet.mjs`.
- [ ] **Step 2: Palette posée avant le premier affichage.** Aujourd'hui `data-palette` n'est posé qu'après le montage de l'application : jusque-là, la page prend la palette claire même en mode sombre. `index.html` porte désormais `<html lang="fr" data-palette="systeme">`, et `main.ts` pose `document.documentElement.dataset.palette = etat.paletteAffichee` juste après `etat.demarrer`, avant `mount`.
- [ ] **Step 3: Chercher ce qui reste de l'éclair** (compétence `superpowers:systematic-debugging`). Sur l'émulateur `Pixel_8` en mode sombre, palette « Comme le système », application arrêtée : enregistrer un lancement à froid (`adb shell screenrecord`) et regarder les images une à une. Attendu : aucune image claire entre l'écran de lancement et la première fiche. S'il en reste, identifier la couche claire (écran de lancement, fond de la fenêtre, fond de la WebView fixé à `#F3F4EF` dans `capacitor.config.ts`, page avant les styles) et la corriger avec ces seuls leviers : `android.backgroundColor` de Capacitor, la couleur `fond_fenetre` écrite par `make-icons.mjs`, `index.html`. Une palette claire choisie à la main sur un appareil en mode sombre peut encore montrer un instant le fond sombre : c'est accepté.
- [ ] **Step 4: Vérifier** — depuis PowerShell : `npm run package:android` (APK de débogage à ce stade), installation sur l'émulateur ; l'application ne tourne plus quand on couche l'appareil ; lancement à froid sans image claire en mode sombre, et sans image sombre en mode clair ; lancer `npm run sync -w @jolis-mots/android` deux fois de suite laisse un seul `screenOrientation` dans le manifeste. Joindre au compte rendu les images du lancement.
- [ ] **Step 5: Commit** — `git commit -m "Android : portrait, plus d'éclair clair au lancement en mode sombre"`

### Task 9: Android : une clé de signature propre

**Files:**
- Modify: `apps/android/build-apk.mjs`, `package.json` (scripts)

Décidé par Philippe (conception, section 13.2). Le fichier de clé vit hors du dépôt ; Philippe le crée et tape lui-même son mot de passe. Aucun mot de passe n'est écrit dans un fichier du dépôt, ni passé sur une ligne de commande.

Comportement de `build-apk.mjs` :

- Sans option : APK signé. `assembleRelease`, puis `zipalign -p -f 4`, puis `apksigner sign`, puis `apksigner verify --print-certs` dont l'empreinte SHA-256 est affichée. Sortie : `apps/android/release/Jolis-Mots-<version>.apk`.
- `--debug` : l'APK de débogage d'aujourd'hui, nommé `Jolis-Mots-<version>-debug.apk`. L'option `--release` et son APK non signé disparaissent.
- Fichier de clé : la variable `JOLISMOTS_KEYSTORE`, sinon `%USERPROFILE%\.jolis-mots\jolis-mots.jks`. Alias : `jolismots`.
- Mot de passe : si la variable `JOLISMOTS_KEYSTORE_PASS` existe, `apksigner` la lit lui-même (`--ks-pass env:JOLISMOTS_KEYSTORE_PASS`) ; sinon il le demande dans le terminal.
- Fichier de clé absent : arrêt avec le chemin attendu et la commande qui le crée, à lancer par Philippe :
  `keytool -genkeypair -v -keystore "%USERPROFILE%\.jolis-mots\jolis-mots.jks" -alias jolismots -keyalg RSA -keysize 4096 -validity 10000`
- `zipalign` et `apksigner` viennent du dossier `build-tools` de version la plus haute du SDK.
- Dossier `android/` absent : arrêt avec « Lancer d'abord `npx cap add android` depuis `apps/android`. ». `ANDROID_HOME` qui ne mène à aucun dossier : arrêt en le disant.

Scripts racine : `package:android` (signé) et `package:android:debug` (`npm run build:android && npm run apk -w @jolis-mots/android -- --debug`).

- [ ] **Step 1: Écrire le script** selon la description.
- [ ] **Step 2: Vérifier le chemin de débogage** — depuis PowerShell, `npm run package:android:debug` produit `Jolis-Mots-0.1.0-debug.apk`, qui s'installe sur l'émulateur.
- [ ] **Step 3: Vérifier le chemin signé avec une clé jetable.** Créer dans le dossier temporaire de la session un fichier de clé d'essai (`keytool … -storepass:env`, mot de passe jetable tenu dans une variable d'environnement de la seule commande), lancer la fabrication avec `JOLISMOTS_KEYSTORE` et `JOLISMOTS_KEYSTORE_PASS` pointant dessus : `apksigner verify` réussit et affiche le certificat d'essai. Sans `JOLISMOTS_KEYSTORE` et sans fichier à l'emplacement par défaut : le script s'arrête avec la commande `keytool`. Supprimer ensuite la clé d'essai et l'APK d'essai : **cet APK ne doit jamais être publié.**
- [ ] **Step 4: Commit** — `git commit -m "Android : APK signé avec une clé propre à Jolis Mots"`

### Task 9b: Le mot à la même taille sur chaque fiche

Demandé par Philippe pendant la construction (24 novembre 2026) : « je n'aime pas trop que le mot n'a pas la même taille à chaque fois ». Aujourd'hui `tailleDuMot` donne 62 px jusqu'à 9 lettres, puis rétrécit en continu jusqu'à 34 px. Décidé par Philippe : **une seule grande taille pour presque tous les mots ; une expression passe sur deux lignes à cette taille ; seuls les mots d'un seul tenant trop longs pour une ligne prennent une seconde taille, plus petite. Deux tailles au lieu d'un dégradé.**

**Files:**
- Modify: `packages/core/src/typographie.ts`, `packages/core/src/typographie.test.ts`, `apps/web/src/composants/Fiche.svelte`, `docs/superpowers/specs/2026-11-24-jolis-mots-design.md` (section 5.1, une phrase)

**Interfaces:**
- Produces:

```ts
export const TAILLE_DU_MOT = 54;        // px, la taille ordinaire
export const TAILLE_DU_MOT_LONG = 40;   // px, la seconde taille
export const LETTRES_SUR_UNE_LIGNE: number; // longueur du plus long morceau qui tient encore sur une ligne à la taille ordinaire
export function tailleDuMot(mot: string): number; // TAILLE_DU_MOT ou TAILLE_DU_MOT_LONG, rien d'autre
```

Règles :

- Un **morceau** est une suite de caractères sans espace ni trait d'union (le navigateur peut passer à la ligne après un trait d'union). `tailleDuMot` regarde le plus long morceau du mot : jusqu'à `LETTRES_SUR_UNE_LIGNE` caractères, la taille ordinaire ; au-delà, la seconde taille. La longueur totale de l'expression ne compte pas : « Grosjean comme devant » est à la taille ordinaire, sur deux lignes.
- La largeur de référence est celle d'un téléphone de 390 px (la colonne de la fiche y fait 334 px). À cette largeur : aucun morceau d'un mot à la taille ordinaire ne dépasse la colonne, et aucun morceau de la liste réelle ne la dépasse à la seconde taille (le plus long est « Abracadabrantesque », 18 lettres).
- 54 et 40 sont des valeurs de départ. Mesurer dans le navigateur, à 390 px de large, la largeur réelle des morceaux les plus larges de la liste (`donnees/mots.json`, mots complets) pour chaque longueur de 11 à 18 lettres, puis fixer `LETTRES_SUR_UNE_LIGNE` à la plus grande longueur dont **tous** les morceaux réels tiennent à la taille ordinaire. Si la seconde taille ne suffit pas pour « Abracadabrantesque », la baisser par pas de 2 px jusqu'à ce qu'il tienne ; ne pas toucher à la taille ordinaire sans le dire dans le compte rendu. Donner les mesures dans le compte rendu, avec le nombre de mots complets à chaque taille.
- Dans `Fiche.svelte`, le mot garde `overflow-wrap: anywhere` comme filet de sûreté, et son interligne convient à deux lignes (une expression sur deux lignes ne doit ni se chevaucher ni s'écarter trop : viser un interligne de 1,05 à 1,1).
- La fiche du Recueil et l'aperçu de l'atelier utilisent le même composant : rien d'autre à changer.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
expect(tailleDuMot('Vénuste')).toBe(TAILLE_DU_MOT);
expect(tailleDuMot('Baguenauder')).toBe(TAILLE_DU_MOT);                 // 11 lettres : plus de dégradé
expect(tailleDuMot('Grosjean comme devant')).toBe(TAILLE_DU_MOT);        // expression : la longueur totale ne compte pas
expect(tailleDuMot('Béni-oui-oui')).toBe(TAILLE_DU_MOT);                 // le trait d'union coupe les morceaux
expect(tailleDuMot('Abracadabrantesque')).toBe(TAILLE_DU_MOT_LONG);
expect(tailleDuMot('x'.repeat(LETTRES_SUR_UNE_LIGNE))).toBe(TAILLE_DU_MOT);
expect(tailleDuMot('x'.repeat(LETTRES_SUR_UNE_LIGNE + 1))).toBe(TAILLE_DU_MOT_LONG);
expect(tailleDuMot('Sans ' + 'x'.repeat(LETTRES_SUR_UNE_LIGNE + 1))).toBe(TAILLE_DU_MOT_LONG);
expect(tailleDuMot('')).toBe(TAILLE_DU_MOT);
// jamais d'autre valeur
for (const m of ['A', 'Éployer', 'Circonvolution', "N'avoir (pas / point) de cesse que + subj."]) {
  expect([TAILLE_DU_MOT, TAILLE_DU_MOT_LONG]).toContain(tailleDuMot(m));
}
```

Les tests existants de `tailleDuMot` qui décrivent le dégradé sont remplacés par ceux-ci.

- [ ] **Step 2: Les lancer** — attendu : échec.
- [ ] **Step 3: Mesurer, puis écrire le code** selon les règles ci-dessus.
- [ ] **Step 4: Mettre la conception à jour.** Dans `docs/superpowers/specs/2026-11-24-jolis-mots-design.md`, section 5.1, après la phrase qui décrit la fiche (« La fiche montre, de haut en bas : … »), ajouter : « Le mot est composé à une seule grande taille ; une expression passe à la ligne entre ses mots. Seul un mot d'un seul tenant trop long pour une ligne prend une seconde taille, plus petite : deux tailles, jamais un dégradé (décidé par Philippe pour la 1.0.0). »
- [ ] **Step 5: Vérifier dans le navigateur**, à 390 px puis 411 px de large, palettes Papier et Nuit : `?mot=herbu`, `?mot=baguenauder`, `?mot=abracadabrantesque`, `?mot=fantasmagorique`, `?mot=grosjean` (ou une autre expression de trois mots de la liste), et le plus long morceau encore à la taille ordinaire : aucun mot ne dépasse la colonne, aucun n'est coupé au milieu d'un morceau, les deux lignes d'une expression sont bien espacées. `npm test` et `npm run check` passent.
- [ ] **Step 6: Commit** — `git commit -m "Fiche : le mot à la même taille, sauf les très longs"`

---

## Deuxième partie : l'atelier

### Task 10: Cœur de l'atelier : la liste et la fiche

**Files:**
- Create: `packages/core/src/atelier.ts`, `packages/core/src/atelier.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `normaliser`, `comparerMots`, `estComplet`.
- Produces:

```ts
export type FiltreAtelier = 'tous' | 'complets' | 'aCompleter' | 'doublons';
export function proposerTri(mot: string): string;
export function groupesDeDoublons(mots: Mot[]): Mot[][];
export function compterFiltres(mots: Mot[]): Record<FiltreAtelier, number>;
export function listerAtelier(mots: Mot[], a: { filtre: FiltreAtelier; requete: string }): Mot[];
export function genresUtilises(mots: Mot[]): string[];
export function homonymes(mots: Mot[], fiche: Pick<Mot, 'id' | 'mot' | 'tri'>): { parMot: Mot[]; parTri: Mot[] };
export function adresseCnrtl(tri: string): string;
export function nouvelleFiche(id: string): Mot;          // tous les champs vides, aCompleter: true
export function nettoyerFiche(f: Mot): Mot;              // `mot` et `tri` sans espaces aux bords ; rien d'autre ne change
export function poserFiche(mots: Mot[], f: Mot): Mot[];  // remplace le mot de même identifiant, sinon l'ajoute
export function retirerFiche(mots: Mot[], id: string): Mot[];
export function lignesDeSources(texte: string): string[]; // une source par ligne non vide ; le texte de chaque ligne est gardé tel quel
```

Règles :

- `proposerTri` : coupe à la première virgule, retire une parenthèse finale, met en minuscules, retire les espaces aux bords (insécables comprises), puis retire un seul préfixe parmi `se `, `s'`, `s’`, `le `, `la `, `les `, `l'`, `l’`, `un `, `une `, `des `. Sur la liste réelle, cette règle retrouve le Tri saisi par Philippe pour 2 333 mots sur 2 524 ; pour les autres (« Sans ambages » → `ambage`), il corrige à la main.
- **Doublons** : deux mots sont liés quand ils ont le même `mot` ou le même `tri`, comparés en minuscules et espaces réduits ; **les accents comptent**, comme à l'import (« Bistre » et « Bistré » ne sont pas des doublons). Le lien est transitif. Sur la liste réelle : 35 groupes, 71 mots.
- `listerAtelier` : ordre de `comparerMots` ; pour `doublons`, les groupes restent entiers et côte à côte, rangés selon leur premier mot ; `requete` filtre sur `mot` et `tri` avec `normaliser` (sans accents ni majuscules) et s'applique à tous les filtres.
- `genresUtilises` : par nombre d'emplois décroissant, puis par ordre alphabétique, sans la valeur vide.
- `homonymes` : mêmes comparaisons que les doublons, sans le mot de même identifiant.
- `adresseCnrtl` : `https://www.cnrtl.fr/definition/` suivi du tri sans espaces aux bords, encodé par `encodeURIComponent`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
expect(proposerTri("S'abolir")).toBe('abolir');
expect(proposerTri('Se carrer')).toBe('carrer');
expect(proposerTri('L’Érèbe')).toBe('érèbe');
expect(proposerTri("S'aboucher (avec)")).toBe('aboucher');
expect(proposerTri('Attiger, atiger')).toBe('attiger');
expect(proposerTri('  Vénuste\u00a0')).toBe('vénuste');
expect(proposerTri('Sans ambages')).toBe('sans ambages');
expect(proposerTri('')).toBe('');
// doublons : même mot ; même tri ; chaîne A–B–C ; accents
expect(groupesDeDoublons([cave1, cave2, bistre, bistreAccent]).map((g) => g.map((m) => m.id))).toEqual([['cave1', 'cave2']]);
expect(groupesDeDoublons([aboucher, sAboucher])).toHaveLength(1);      // même tri « aboucher »
expect(groupesDeDoublons([a, b, c])[0]).toHaveLength(3);               // a.mot = b.mot, b.tri = c.tri
expect(groupesDeDoublons([{ ...cave1, mot: 'cave ' }, cave2])).toHaveLength(1);
// compteurs
const n = compterFiltres(liste);
expect(n.tous).toBe(liste.length);
expect(n.complets + n.aCompleter).toBe(n.tous);
expect(n.doublons).toBe(groupesDeDoublons(liste).flat().length);
// liste : la recherche ignore accents et majuscules, et s'applique dans un filtre
expect(listerAtelier(liste, { filtre: 'aCompleter', requete: 'VENUS' }).map((m) => m.mot)).toEqual(['Vénusté']);
expect(listerAtelier(liste, { filtre: 'doublons', requete: '' }).map((m) => m.id)).toEqual(['abo1', 'abo2', 'cave1', 'cave2']);
expect(genresUtilises([adj, adj, verbe, sansGenre])).toEqual(['adj.', 'verbe trans.']);
expect(homonymes([cave1, cave2], cave1)).toEqual({ parMot: [cave2], parTri: [cave2] });
expect(adresseCnrtl(' éployer ')).toBe('https://www.cnrtl.fr/definition/%C3%A9ployer');
expect(nouvelleFiche('k3f9x2')).toEqual({ id: 'k3f9x2', mot: '', tri: '', genre: '', definition: '', sources: [], note: '', util: '', aCompleter: true });
// la fiche nettoyée ne touche que mot et tri
const brute = { ...cave1, mot: ' Cave\u00a0', tri: ' cave ', definition: '  1. Texte \n\n ', genre: ' adj. ', note: ' 8 ' };
expect(nettoyerFiche(brute)).toEqual({ ...brute, mot: 'Cave', tri: 'cave' });
expect(lignesDeSources('A: B (1)\n\n C \n')).toEqual(['A: B (1)', ' C ']);
expect(poserFiche([cave1], { ...cave1, genre: 'x' })).toEqual([{ ...cave1, genre: 'x' }]);
expect(poserFiche([cave1], cave2)).toHaveLength(2);
expect(retirerFiche([cave1, cave2], 'cave1')).toEqual([cave2]);
```

- [ ] **Step 2: Les lancer** — attendu : échec.
- [ ] **Step 3: Écrire le code.** Aucune fonction ne modifie son entrée.
- [ ] **Step 4: Relancer** — attendu : tout passe.
- [ ] **Step 5: Commit** — `git commit -m "Atelier : tri proposé, doublons, filtres et fiche, sans interface"`

### Task 11: Cœur de l'atelier : ce qui part vers le téléphone

**Files:**
- Create: `packages/core/src/envoi.ts`, `packages/core/src/envoi.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:

```ts
export interface Modifications { ajoutes: number; modifies: number; supprimes: number; total: number }
export function compterModifications(envoyes: Mot[], locaux: Mot[]): Modifications;
export function decrireModifications(m: Modifications): string;      // « 3 mots modifiés, 1 ajouté »
export function messageDEnvoi(m: Modifications, date: Date): string; // « Liste du 24 novembre 2026 : 3 mots modifiés, 1 ajouté »
export function validerPourEnvoi(f: FichierMots): string[];          // phrases à afficher ; vide quand la liste peut partir
export function dater(f: FichierMots, maintenant: Date): FichierMots; // `publie` = date ISO sans millisecondes
```

`compterModifications` apparie les mots par identifiant ; un mot est modifié quand un de ses champs diffère (l'ordre des sources compte). `decrireModifications` : dans l'ordre modifiés, ajoutés, supprimés, en sautant les zéros, au singulier pour 1 ; chaîne vide quand rien n'a changé. `messageDEnvoi` : date longue en français de Suisse (`fr-CH`), heure locale ; sans changement, « Liste du 24 novembre 2026 » seul.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
expect(compterModifications([a, b], [b, a])).toEqual({ ajoutes: 0, modifies: 0, supprimes: 0, total: 0 });
expect(compterModifications([a, b], [{ ...a, note: '8' }, b, c])).toEqual({ ajoutes: 1, modifies: 1, supprimes: 0, total: 2 });
expect(compterModifications([a, b], [a]).supprimes).toBe(1);
expect(compterModifications([a], [{ ...a, sources: [...a.sources].reverse() }]).modifies).toBe(1); // a porte deux sources
expect(compterModifications([a], [{ ...a, aCompleter: !a.aCompleter }]).modifies).toBe(1);
expect(compterModifications([a], [{ ...{ ...a, genre: 'x' }, genre: a.genre }]).total).toBe(0);   // remis comme avant
const le24 = new Date(2026, 10, 24, 15, 30);
expect(messageDEnvoi({ ajoutes: 1, modifies: 3, supprimes: 0, total: 4 }, le24)).toBe('Liste du 24 novembre 2026 : 3 mots modifiés, 1 ajouté');
expect(messageDEnvoi({ ajoutes: 0, modifies: 1, supprimes: 2, total: 3 }, le24)).toBe('Liste du 24 novembre 2026 : 1 mot modifié, 2 supprimés');
expect(messageDEnvoi({ ajoutes: 0, modifies: 0, supprimes: 0, total: 0 }, le24)).toBe('Liste du 24 novembre 2026');
expect(decrireModifications({ ajoutes: 2, modifies: 0, supprimes: 0, total: 2 })).toBe('2 mots ajoutés');
expect(validerPourEnvoi({ format: 1, publie: '', mots: [] })).toEqual(['La liste est vide.']);
expect(validerPourEnvoi(liste([a, { ...b, id: a.id }]))).toEqual([`Deux mots portent le même identifiant (${a.id}).`]);
expect(validerPourEnvoi(liste([{ ...a, id: '' }]))).toEqual(["Un mot n'a pas d'identifiant."]);
expect(validerPourEnvoi(liste([{ ...a, mot: '  ' }]))).toEqual([`Un mot n'a pas de nom (identifiant ${a.id}).`]);
expect(validerPourEnvoi(liste([a, b]))).toEqual([]);
expect(dater(liste([a]), new Date('2026-11-24T14:53:21.789Z')).publie).toBe('2026-11-24T14:53:21Z');
// Review Focus 1 : le texte collé du CNRTL revient identique
const colle = 'A.\u00a0−\u202fPasser\tson temps « à rêvasser » ; l’apostrophe, "guillemets", C:\\chemin\u2028suite 😀  \n\n';
const relu = validerFichier(JSON.parse(ecrireFichier(liste([{ ...a, definition: colle, sources: [' Auteur: Titre (1) '], note: ' 8 ' }]))));
expect(relu?.mots[0]).toEqual({ ...a, definition: colle, sources: [' Auteur: Titre (1) '], note: ' 8 ' });
```

- [ ] **Step 2: Les lancer** — attendu : échec.
- [ ] **Step 3: Écrire le code.**
- [ ] **Step 4: Relancer** — attendu : tout passe.
- [ ] **Step 5: Commit** — `git commit -m "Atelier : compteur de modifications, message et contrôle avant envoi"`

### Task 12: Le pont et le dépôt

**Files:**
- Create: `packages/core/src/pont.ts`, `apps/desktop/package.json` (minimal : nom `@jolis-mots/desktop`, `private`, version, dépendance `@jolis-mots/core`), `apps/desktop/src/depot.ts`, `apps/desktop/src/depot.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:

```ts
// packages/core/src/pont.ts — le contrat entre l'application web et Electron (types seulement)
export type RaisonDepot = 'pret' | 'sans-git' | 'sans-reseau' | 'refus' | 'divergence' | 'erreur';
export interface EtatDepot {
  raison: RaisonDepot;       // 'pret' : la dernière opération a réussi
  detail: string;            // dernier message de git, '' si tout va bien
  locale: string | null;     // texte de mots.json dans la copie de travail ; null tant qu'il n'y a pas de copie
  envoyee: string | null;    // texte de mots.json dans la dernière liste envoyée ou reçue (origin/donnees)
  sauvegarde: string | null; // chemin du fichier mis de côté par `reprendre`, sinon null
}
export interface PontBureau {
  ouvrir(): Promise<EtatDepot>;                               // sans réseau : ce qui est sur le disque
  synchroniser(): Promise<EtatDepot>;                         // télécharge la copie si elle manque, sinon va voir la liste en ligne
  enregistrer(texte: string): Promise<EtatDepot>;
  envoyer(texte: string, message: string): Promise<EtatDepot>;
  reprendre(): Promise<EtatDepot>;
  ouvrirCnrtl(adresse: string): Promise<void>;
  signalerFicheModifiee(modifiee: boolean): void;
}

// apps/desktop/src/depot.ts — Node seul, sans Electron
export const ADRESSE_DEPOT = 'https://github.com/iago-swi/jolis-mots.git';
export const BRANCHE = 'donnees';
export const FICHIER = 'mots.json';
export interface Depot { dossier: string; sauvegardes: string; adresse: string; git?: string } // `git` : nom du programme, 'git' par défaut
export function ouvrir(d: Depot): Promise<EtatDepot>;
export function synchroniser(d: Depot): Promise<EtatDepot>;
export function enregistrer(d: Depot, texte: string): Promise<EtatDepot>;
export function envoyer(d: Depot, texte: string, message: string): Promise<EtatDepot>;
export function reprendre(d: Depot, maintenant: Date): Promise<EtatDepot>;
export function classer(stderr: string): RaisonDepot;
```

Règles du dépôt :

- `git` est lancé par `execFile(d.git ?? 'git', […], { cwd, windowsHide: true, env: { ...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' } })`. Programme introuvable : `'sans-git'`. Les opérations passent une à la fois (file d'attente interne). Aucune fonction ne lève : une panne revient dans `raison` et `detail`.
- **Téléchargement** : `git clone -c core.autocrlf=false --single-branch --branch donnees <adresse> <dossier>`. Si `<dossier>` existe sans `.git` (téléchargement interrompu), il est d'abord déplacé dans `<sauvegardes>/donnees-<AAAA-MM-JJ-HHMMSS>`.
- **Écriture** : fichier temporaire dans le même dossier, puis renommage ; UTF-8 sans BOM ; les octets sont exactement ceux du texte reçu.
- `ouvrir` : aucun appel au réseau. Sans copie : `{ raison: 'pret', locale: null, envoyee: null }`.
- `synchroniser` : sans copie, la télécharge. Sinon `git fetch origin donnees`, puis :
  - la liste en ligne n'a pas bougé, ou la copie a seulement une version pas encore envoyée : `'pret'` ;
  - la liste en ligne a avancé et rien n'attend ici (fichier identique à la dernière version locale, aucune version locale en avance) : avance rapide (`git merge --ff-only origin/donnees`), `'pret'` ;
  - la liste en ligne a avancé et quelque chose attend ici : `'divergence'`, rien n'est touché.
- `envoyer` : écrit le fichier ; `git fetch` (échec : la raison classée, rien d'autre) ; si la liste en ligne n'est pas un ancêtre de la version locale : `'divergence'` ; `git add mots.json` ; `git commit -m <message>` seulement s'il y a quelque chose à valider ; `git push origin donnees`. Un envoi qui échoue laisse la version locale en place : l'essai suivant l'envoie sans en créer une seconde.
- `reprendre` : copie le fichier local vers `<sauvegardes>/mots-<AAAA-MM-JJ-HHMMSS>.json`, puis `git fetch` et `git reset --hard origin/donnees` (dans cette copie privée seulement) ; `sauvegarde` porte le chemin.
- `classer` (messages de git en anglais) : `Could not resolve host`, `Failed to connect`, `timed out`, `unable to access` sans code 403 → `'sans-reseau'` ; `Authentication failed`, `Permission`+`denied`, `403` → `'refus'` ; `[rejected]`, `non-fast-forward`, `fetch first` → `'divergence'` ; le reste → `'erreur'`.

- [ ] **Step 1: Écrire les tests qui échouent.** Ils utilisent le vrai `git` dans un dossier temporaire : un dépôt nu `origine.git` qui porte la branche `donnees` avec un `mots.json`, et un `Depot` dont l'adresse est ce dossier. L'identité de commit est donnée aux tests par `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`. Délai de 30 s par test.

```ts
// 1. sans copie : ouvrir → locale null ; synchroniser → copie téléchargée
expect((await ouvrir(d)).locale).toBeNull();
const e1 = await synchroniser(d);
expect(e1).toMatchObject({ raison: 'pret', locale: TEXTE_ORIGINE, envoyee: TEXTE_ORIGINE });
expect(readFileSync(join(d.dossier, 'mots.json'))).toEqual(Buffer.from(TEXTE_ORIGINE, 'utf8')); // ni BOM, ni \r\n
// 2. enregistrer : octets exacts, la liste envoyée ne bouge pas (Review Focus 1)
const T2 = TEXTE_ORIGINE.replace('"note":""', '"note":"\u00a0\u202f😀\\u2028"');
expect(await enregistrer(d, T2)).toMatchObject({ raison: 'pret', locale: T2, envoyee: TEXTE_ORIGINE });
expect(readFileSync(join(d.dossier, 'mots.json'))).toEqual(Buffer.from(T2, 'utf8'));
// 3. envoyer : une version de plus en ligne, avec le message ; un second envoi identique n'en ajoute pas
expect(await envoyer(d, T2, 'Liste du 24 novembre 2026 : 1 mot modifié')).toMatchObject({ raison: 'pret', envoyee: T2 });
expect(versionsEnLigne()).toBe(2);
expect(dernierMessageEnLigne()).toBe('Liste du 24 novembre 2026 : 1 mot modifié');
await envoyer(d, T2, 'encore');
expect(versionsEnLigne()).toBe(2);
// 4. Review Focus 2 : envoi coupé, puis repris
renameSync(origine, origine + '.absent');
const coupe = await envoyer(d, T3, 'message 3');
expect(coupe.raison).not.toBe('pret');
expect(coupe).toMatchObject({ locale: T3, envoyee: T2 });
expect((await ouvrir(d)).locale).toBe(T3);                 // comme après un redémarrage
renameSync(origine + '.absent', origine);
expect((await envoyer(d, T3, 'message 3')).raison).toBe('pret');
expect(versionsEnLigne()).toBe(3);                         // une seule version de plus
// 4 bis. le dépôt en ligne refuse la version (crochet pre-receive qui sort en erreur) : raison autre que 'pret', la version locale reste ;
//        crochet retiré, le même envoi passe et n'ajoute qu'une version en ligne
// 5. la liste en ligne avance ailleurs, rien n'attend ici → reprise silencieuse
pousserDepuisUnAutreClone(T4);
expect(await synchroniser(d)).toMatchObject({ raison: 'pret', locale: T4, envoyee: T4 });
// 6. Review Focus 3 : la liste en ligne avance ailleurs, des modifications attendent ici
await enregistrer(d, T5);
pousserDepuisUnAutreClone(T6);
expect(await synchroniser(d)).toMatchObject({ raison: 'divergence', locale: T5 });
expect((await envoyer(d, T5, 'm')).raison).toBe('divergence');
expect(contenuEnLigne()).toBe(T6);                         // rien n'a été écrasé
const repris = await reprendre(d, new Date(2026, 10, 24, 15, 30, 12));
expect(repris).toMatchObject({ raison: 'pret', locale: T6, envoyee: T6 });
expect(repris.sauvegarde).toMatch(/mots-2026-11-24-153012\.json$/);
expect(readFileSync(repris.sauvegarde!, 'utf8')).toBe(T5);
// 7. Review Focus 5 : dossier sans .git → mis de côté, puis copie téléchargée
// 8. Review Focus 5 : git introuvable
expect((await synchroniser({ ...d, git: 'git-introuvable' })).raison).toBe('sans-git');
// 9. classer
expect(classer("fatal: unable to access 'https://github.com/x/': Could not resolve host: github.com")).toBe('sans-reseau');
expect(classer('remote: Permission to iago-swi/jolis-mots.git denied to autre.')).toBe('refus');
expect(classer("fatal: unable to access 'https://github.com/x/': The requested URL returned error: 403")).toBe('refus');
expect(classer(' ! [rejected]        donnees -> donnees (fetch first)')).toBe('divergence');
expect(classer('fatal: quelque chose')).toBe('erreur');
```

- [ ] **Step 2: Les lancer** — `npx vitest run apps/desktop` ; attendu : échec.
- [ ] **Step 3: Écrire `pont.ts` et `depot.ts`.**
- [ ] **Step 4: Relancer** — attendu : tout passe ; `npm run check` passe. Vérifier que rien n'a touché le vrai dépôt : `git -C donnees status -sb` montre `## donnees...origin/donnees` sans changement.
- [ ] **Step 5: Commit** — `git commit -m "Atelier : copie locale des mots et envoi par git"`

### Task 13: L'application sur bureau : pont, liste locale, onglet

**Files:**
- Create: `apps/web/src/pont.ts`, `apps/web/src/pont-demo.ts`, `apps/web/src/atelier.svelte.ts`, `apps/web/src/atelier.test.ts`, `apps/web/src/ecrans/Atelier.svelte` (titre seul, rempli à la tâche 14)
- Modify: `apps/web/src/main.ts`, `apps/web/src/etat.svelte.ts` (écran `'atelier'`), `apps/web/src/App.svelte`, `apps/web/src/composants/Onglets.svelte`

**Interfaces:**
- Consumes: `PontBureau`, `EtatDepot` (tâche 12) ; `compterModifications`, `validerPourEnvoi`, `dater`, `messageDEnvoi` (tâche 11) ; `poserFiche`, `retirerFiche`, `nettoyerFiche`, `nouvelleFiche` (tâche 10) ; `creerIdUnique` (tâche 1) ; `etat.remplacerListe` (tâche 5).
- Produces:

```ts
// pont.ts
export const pont: PontBureau | null; // window.jolisMots s'il existe ; sinon le pont de démonstration si l'adresse porte « ?pont=demo » ; sinon null
// pont-demo.ts — tout en mémoire, pour le développement dans un navigateur et pour les captures
export function creerPontDemo(depart: FichierMots, params: URLSearchParams): PontBureau; // « &envoi=sans-reseau|refus|divergence » fait échouer l'envoi ainsi
// atelier.svelte.ts
export interface Avis { ton: 'calme' | 'alerte'; texte: string }
export class Atelier {
  constructor(pont: PontBureau);
  depot: EtatDepot | null;
  readonly disponible: boolean;            // une copie locale existe et se lit
  readonly modifications: Modifications;   // entre la liste envoyée et etat.liste
  occupe: boolean;
  avis: Avis | null;
  demarrer(): Promise<void>;               // ouvrir, poser la liste locale, puis synchroniser sans bloquer
  reessayer(): Promise<void>;              // synchroniser
  enregistrer(f: Mot): Promise<boolean>;
  supprimer(id: string): Promise<boolean>;
  envoyer(): Promise<void>;
  reprendre(): Promise<void>;
  idNeuf(): string;
}
export const atelier: Atelier | null;      // null hors bureau
```

Comportement :

- `demarrer` : `pont.ouvrir()` ; si `locale` se lit et passe `validerFichier`, `etat.remplacerListe` ; puis `pont.synchroniser()` en arrière-plan, dont le résultat remplace la liste seulement si `locale` a changé. `main.ts`, sur bureau, attend la première moitié avant `etat.demarrer(location)` et n'appelle pas `rafraichir()`.
- `enregistrer` : `nettoyerFiche`, `poserFiche`, `pont.enregistrer(ecrireFichier(liste))` ; en cas de succès, `etat.remplacerListe` et `true` ; sinon l'état ne change pas, un avis, et `false`. `supprimer` de même, avec `retirerFiche`.
- `envoyer` : `validerPourEnvoi` d'abord (en cas de phrase, avis d'alerte avec ces phrases et aucun appel au pont) ; puis `dater`, `pont.envoyer(texte, messageDEnvoi(modifications, maintenant))`.
- Les avis, mot pour mot :

| Situation | Ton | Texte |
| --- | --- | --- |
| envoi réussi | calme | Liste envoyée. Le téléphone la verra dans quelques minutes. |
| `sans-reseau` à l'envoi | alerte | Pas de réseau : la liste n'est pas partie. Tes modifications restent en attente. |
| `refus` | alerte | GitHub a refusé l'envoi. Tes modifications restent en attente. |
| `divergence` | alerte | La liste en ligne a changé ailleurs. Rien n'a été envoyé. |
| `erreur` à l'envoi | alerte | L'envoi a échoué. Tes modifications restent en attente. |
| `sans-git` | alerte | Git est introuvable sur cette machine. L'atelier en a besoin pour recevoir et envoyer la liste. |
| pas de copie, `sans-reseau` | alerte | L'atelier a besoin d'une connexion une première fois, pour recevoir la liste. |
| copie illisible | alerte | Le fichier des mots de l'atelier est illisible. Tu peux reprendre la liste en ligne ; ta version sera mise de côté. |
| enregistrement échoué | alerte | La fiche n'a pas pu être enregistrée. |
| reprise faite | calme | La liste en ligne est reprise. Ta version est gardée ici : `<chemin>` |

  Sous un avis d'alerte, `depot.detail` est affiché en petit quand il n'est pas vide.

- Sur bureau : quatrième onglet « Atelier » (`#atelier`) ; les écrans Mot, Quiz, Recueil et Réglages tiennent dans une colonne centrée de 560 px ; l'Atelier prend toute la largeur. Hors bureau, `#atelier` mène à l'écran Mot et l'onglet n'existe pas.

- [ ] **Step 1: Écrire les tests qui échouent** dans `atelier.test.ts`, avec un faux `PontBureau` qui note ses appels et dont chaque méthode rend l'`EtatDepot` voulu (même préparation que `etat.test.ts`).

```ts
// démarrage : la liste locale remplace l'embarquée
await atelier.demarrer();
expect(etat.liste.publie).toBe(locale.publie);
expect(atelier.disponible).toBe(true);
// Review Focus 5 : copie illisible
// ouvrir rend locale: '{"format":1,"publie":' → disponible false, avis « Le fichier des mots de l'atelier est illisible. … », etat.liste reste l'embarquée
// pas de copie et pas de réseau → avis « L'atelier a besoin d'une connexion une première fois, … »
// enregistrer : mot et tri nettoyés, définition intacte, texte écrit par ecrireFichier
expect(await atelier.enregistrer({ ...fiche, mot: ' Vénuste ', definition: '  1. Texte \n' })).toBe(true);
expect(JSON.parse(faux.enregistre.at(-1)!).mots.find((m) => m.id === fiche.id)).toMatchObject({ mot: 'Vénuste', definition: '  1. Texte \n' });
expect(atelier.modifications.total).toBe(1);
// enregistrement qui échoue : rien ne change
// envoi d'une liste fautive : aucun appel au pont
expect(faux.envois).toHaveLength(0);
expect(atelier.avis).toEqual({ ton: 'alerte', texte: 'Deux mots portent le même identifiant (k3f9x2).' });
// envoi réussi : publie mis à jour, message de version, compteur à zéro
expect(faux.envois[0]!.message).toBe('Liste du 24 novembre 2026 : 1 mot modifié'); // horloge fixée par vi.setSystemTime
expect(atelier.modifications.total).toBe(0);
// chaque raison d'échec donne son avis, mot pour mot (tableau ci-dessus)
// Review Focus 4 : supprimer le mot affiché sur l'écran Mot
await atelier.supprimer(etat.motCourant!.id);
expect(etat.motCourant).not.toBeNull();
// Review Focus 4 : le mot d'un favori et d'un progrès est renommé → même identifiant, favori et progrès intacts
// idNeuf ne rend jamais un identifiant déjà porté
```

- [ ] **Step 2: Les lancer** — attendu : échec.
- [ ] **Step 3: Écrire le code** et le pont de démonstration.
- [ ] **Step 4: Vérifier** — `npm test` et `npm run check` passent. Dans le navigateur : `http://localhost:5173/` n'a que trois onglets ; `http://localhost:5173/?pont=demo` en a quatre, la colonne de lecture est centrée à 1280 px de large, et l'application du téléphone à 390 px est inchangée.
- [ ] **Step 5: Commit** — `git commit -m "Bureau : liste locale, onglet Atelier, état de l'atelier"`

### Task 14: L'écran Atelier : la liste, la fiche, l'aperçu

**Files:**
- Create: `apps/web/src/composants/atelier/ListeMots.svelte`, `FicheAtelier.svelte`, `Apercu.svelte`
- Modify: `apps/web/src/ecrans/Atelier.svelte`, `apps/web/src/atelier.svelte.ts`, `apps/web/src/atelier.test.ts`

**Interfaces:**
- Consumes: tâches 10 et 13 ; `Fiche.svelte` pour l'aperçu ; `volet` (tâche 7) pour les confirmations.
- Produces (ajouts à la classe `Atelier`) :

```ts
filtre: FiltreAtelier; requete: string;
brouillon: Mot | null;                    // la fiche en cours de saisie
readonly modifiee: boolean;               // le brouillon diffère du mot enregistré, ou c'est un mot nouveau qui a du texte
demande: { genre: 'quitter' | 'supprimer'; suite: () => void } | null; // confirmation en attente
choisir(id: string): void;                // demande confirmation si `modifiee`
nouveau(): void;                          // idem ; brouillon vide, « À compléter » coché
saisirMot(texte: string): void;           // met aussi le Tri à jour tant qu'il suit la proposition
saisirTri(texte: string): void;           // le Tri ne suit plus
demanderSuppression(): void;
confirmer(): void; annuler(): void;
```

Le Tri **suit** la proposition quand la fiche est nouvelle, ou quand le Tri enregistré vaut `proposerTri(mot)` ; dès que Philippe tape dans le champ Tri, il ne suit plus.

L'écran, d'après `docs/superpowers/specs/maquette/Atelier.dc.html` (trois colonnes, libellés de la maquette) :

- **À gauche** : « Chercher un mot » ; les filtres « Tous les mots », « Complets », « À compléter », « Doublons » avec leur nombre (`compterFiltres`) ; la liste (`listerAtelier`), chaque ligne montrant le mot et son genre abrégé, ou « À compléter » ; dans le filtre Doublons, un filet sépare les groupes ; « Nouveau mot ». Les 2 524 lignes défilent sans à-coup (`content-visibility: auto`).
- **Au centre** : Mot, Tri, Genre (champ libre, suggestions de `genresUtilises`), Définition (zone de texte haute, aide « Tes balises habituelles : 1. 2. · [Litt.] · EX: · SYN: · US: »), Source (aide « Une ligne par livre : Auteur: Titre (page) », lue par `lignesDeSources`), Note, « Utilisé dans mes livres » (Util.), la case « À compléter ». Puis « Ouvrir dans le CNRTL » (`pont.ouvrirCnrtl(adresseCnrtl(tri))`, inactif sans Tri), « Supprimer ce mot », « Enregistrer ».
  - « Enregistrer » est inactif sans Mot ; un Tri vide est rempli par `proposerTri` à l'enregistrement. Ctrl+S enregistre.
  - Avertissements, sans bloquer (`homonymes`) : « Ce mot existe déjà : Cave (subst. fém.). » et « Ce tri est déjà celui de : Aboucher. ».
  - Confirmations (`use:volet`) : « Quitter cette fiche sans l'enregistrer ? » avec « Quitter la fiche » et « Rester » ; « Supprimer « Vénuste » ? » avec « Supprimer » et « Annuler ». Changer d'onglet avec une fiche modifiée pose la première question.
  - Sans fiche choisie : « Choisis un mot dans la liste, ou crée-en un. ».
- **À droite** : « Aperçu sur le téléphone », la `Fiche` du brouillon dans un cadre de 390 px de large, mise à jour à chaque frappe ; dessous, la note de la maquette (« La fiche se met en forme toute seule à partir de tes balises. La typographie est corrigée à l'affichage : apostrophes, guillemets, espaces fines. »).

- [ ] **Step 1: Écrire les tests qui échouent** (logique de la fiche, dans `atelier.test.ts`)

```ts
atelier.nouveau();
expect(atelier.brouillon).toMatchObject({ mot: '', aCompleter: true });
atelier.saisirMot("S'abolir");
expect(atelier.brouillon!.tri).toBe('abolir');   // le Tri suit
atelier.saisirTri('abol');
atelier.saisirMot("S'abolir encore");
expect(atelier.brouillon!.tri).toBe('abol');     // il ne suit plus
// un mot enregistré dont le Tri n'est pas la proposition (« Sans ambages » / « ambage ») ne suit pas
// modifiee : faux après choisir, vrai après une frappe, faux une fois le texte remis comme avant
// choisir un autre mot avec une fiche modifiée : demande 'quitter' ; annuler garde le brouillon ; confirmer l'abandonne
// demanderSuppression puis confirmer : le mot quitte etat.liste, le brouillon est vide
// la définition du brouillon arrive à pont.enregistrer au caractère près
```

- [ ] **Step 2: Les lancer** — attendu : échec.
- [ ] **Step 3: Écrire la logique, puis les trois composants.**
- [ ] **Step 4: Vérifier dans le navigateur**, `http://localhost:5173/?pont=demo#atelier`, à 1280 × 800 et à 1000 × 700, dans les quatre palettes : comparer à la maquette ; créer un mot, le voir apparaître dans « À compléter », saisir une définition à balises et voir l'aperçu se former ; décocher « À compléter », enregistrer, puis retrouver le mot dans l'onglet Recueil ; filtre Doublons : « Cave » et « Cave » côte à côte ; chercher « venus » trouve « Vénuste » ; tout le parcours au clavier. `npm test` et `npm run check` passent.
- [ ] **Step 5: Commit** — `git commit -m "Atelier : liste, fiche et aperçu"`

### Task 15: L'écran Atelier : l'envoi et les pannes

**Files:**
- Create: `apps/web/src/composants/atelier/BarreEnvoi.svelte`
- Modify: `apps/web/src/ecrans/Atelier.svelte`

**Interfaces:**
- Consumes: `atelier.modifications`, `atelier.avis`, `atelier.occupe`, `atelier.disponible`, `atelier.depot`, `atelier.envoyer`, `atelier.reprendre`, `atelier.reessayer` (tâche 13) ; `decrireModifications` (tâche 11).

- **La barre du haut** : « Atelier » ; le compteur « 3 modifications pas encore envoyées » (« 1 modification pas encore envoyée » ; « Tout est envoyé » à zéro), avec dessous, en petit, `decrireModifications` ; le bouton « Envoyer au téléphone », inactif à zéro, pendant un envoi (« Envoi… ») et sans copie locale. L'avis s'affiche sous la barre (`role="status"`), avec `depot.detail` en petit.
- **Liste en ligne changée** (`raison: 'divergence'`) : l'avis est suivi de « Reprendre la liste en ligne », qui demande confirmation (« Ta version sera mise de côté dans un fichier daté, puis remplacée par la liste en ligne. » ; « Reprendre » et « Annuler »).
- **Atelier indisponible** (`atelier.disponible` faux) : à la place des trois colonnes, l'avis, puis « Réessayer » ; pour une copie illisible, « Reprendre la liste en ligne ».
- Un effet appelle `pont.signalerFicheModifiee(atelier.modifiee)` à chaque changement.

- [ ] **Step 1: Écrire le composant et brancher les états.**
- [ ] **Step 2: Vérifier dans le navigateur** avec le pont de démonstration : `?pont=demo#atelier` — modifier deux mots, le compteur dit « 2 modifications pas encore envoyées », l'envoi réussit et le compteur revient à « Tout est envoyé » ; `?pont=demo&envoi=sans-reseau#atelier`, `&envoi=refus`, `&envoi=divergence` : l'avis attendu, le compteur intact, la reprise et sa confirmation. Palettes Papier et Nuit. `npm test` et `npm run check` passent.
- [ ] **Step 3: Commit** — `git commit -m "Atelier : envoi au téléphone, pannes dites en clair"`

### Task 16: L'enveloppe Electron

**Files:**
- Create: `apps/desktop/build.mjs`, `apps/desktop/make-icons.mjs`, `apps/desktop/src/main.ts`, `apps/desktop/src/preload.ts`, `apps/desktop/assets/icon.png`, `apps/desktop/assets/icon.ico`
- Modify: `apps/desktop/package.json`, `package.json` (scripts)

**Interfaces:**
- Consumes: `depot.ts` et `PontBureau` (tâche 12).
- Produces: `window.jolisMots: PontBureau` dans la page ; les scripts `npm run build:desktop` (`npm run build`, puis le paquet du bureau) et `npm run start:desktop`.

Modèle : `..\Capitales\Claude\apps\desktop\`. Ce qui diffère :

- La page se charge par `win.loadFile` (`dist/web/index.html`) : pas de serveur. `webPreferences` : `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `preload`. `window.open` est refusé, toute navigation hors de la page aussi.
- `preload.ts` expose `jolisMots` par `contextBridge` ; chaque méthode passe par `ipcRenderer.invoke` sur les canaux `depot:ouvrir`, `depot:synchroniser`, `depot:enregistrer`, `depot:envoyer`, `depot:reprendre`, `cnrtl:ouvrir`, et `ipcRenderer.send` sur `fiche:modifiee`.
- `main.ts` : dépôt dans `path.join(app.getPath('userData'), 'donnees')`, sauvegardes dans `…/sauvegardes`, adresse `process.env.JOLISMOTS_DEPOT ?? ADRESSE_DEPOT` ; si `JOLISMOTS_DONNEES` existe, `app.setPath('userData', …)` avant tout. `cnrtl:ouvrir` n'ouvre dans le navigateur que les adresses qui commencent par `https://www.cnrtl.fr/definition/`.
- Une seule instance. Fenêtre : 1280 × 820 souhaités, 960 × 640 au minimum, taille et place retenues comme dans Capitales ; fond de fenêtre `#14181F` si Windows est en mode sombre, sinon `#F3F4EF` ; titre « Jolis Mots ». Menu en français : « Jolis Mots » (Recharger, Outils de développement, Quitter) et « Affichage » (zoom, plein écran), barre de menu masquée d'office.
- Fermer la fenêtre avec une fiche modifiée : boîte « Quitter sans enregistrer la fiche ? », boutons « Quitter » et « Annuler », Annuler par défaut.
- `build.mjs` : esbuild assemble `main.ts` et `preload.ts` en CommonJS (`dist/main.cjs`, `dist/preload.cjs`, `electron` externe), copie `apps/web/dist` dans `dist/web`, et l'icône. `make-icons.mjs` tire `assets/icon.png` (512 px) et `assets/icon.ico` de `apps/android/assets/icone.svg`.
- Dépendances de développement : `electron` 45.4.1 (version exacte), `esbuild`, `electron-builder`, `png-to-ico`, `sharp`.

- [ ] **Step 1: Écrire les fichiers.**
- [ ] **Step 2: Préparer un dépôt d'essai.** Dans le dossier temporaire de la session : un dépôt nu avec une branche `donnees` portant une copie de `donnees/mots.json`, et un dossier de données vide.
- [ ] **Step 3: Vérifier de bout en bout**, avec `JOLISMOTS_DEPOT` et `JOLISMOTS_DONNEES` pointant sur ces deux dossiers, `npm run start:desktop` : la fenêtre s'ouvre sur un mot, sans éclair blanc ; quatre onglets ; dans l'Atelier, modifier un mot, enregistrer, envoyer : `git --git-dir <dépôt nu> log --oneline donnees` montre une version « Liste du … : 1 mot modifié » et `git show donnees:mots.json` porte la modification, tandis que `git ls-remote origin donnees` du projet est inchangé ; renommer le dépôt nu, modifier, envoyer : l'avis de panne, le compteur intact ; fermer et rouvrir : la modification est toujours là et le compteur aussi ; remettre le dépôt, envoyer : une seule version de plus ; « Ouvrir dans le CNRTL » ouvre le navigateur ; fermer avec une fiche modifiée pose la question. `npm test` et `npm run check` passent.
- [ ] **Step 4: Commit** — `git commit -m "Windows : enveloppe Electron et pont vers git"`

### Task 17: Les paquets Windows, des données fraîches, l'import gardé

**Files:**
- Create: `scripts/maj-donnees.mjs`
- Modify: `apps/desktop/package.json` (section `build`), `package.json` (scripts), `tools/import/importer.ts`

- **electron-builder** : `appId` `ch.noth.jolismots`, `productName` `Jolis Mots`, sortie `apps/desktop/release`, cibles Windows x64 `nsis` (installeur à étapes, dossier au choix, raccourci « Jolis Mots ») et `portable`. Fichiers produits : `Jolis-Mots-<version>-setup.exe` et `Jolis-Mots-<version>-portable.exe`. La version est celle du `package.json` racine (`-c.extraMetadata.version=…`).
- **Scripts racine** : `package:desktop` = `node scripts/maj-donnees.mjs && npm run build:desktop && npm run package -w @jolis-mots/desktop`. `package:android` et `package:android:debug` commencent eux aussi par `node scripts/maj-donnees.mjs`.
- **`scripts/maj-donnees.mjs`** : `git -C donnees pull --ff-only`. Réussi : dit de quelle date est la liste. Sans réseau : avertit (« Pas de réseau : la fabrication embarque la liste du … ») et continue. Dossier `donnees/` absent, modifié à la main ou en désaccord avec la liste en ligne : s'arrête en disant quoi faire. La liste embarquée dans l'application est ainsi la dernière envoyée par l'atelier.
- **Import gardé** : `tools/import/importer.ts` s'arrête dès le début sans l'option `--ecraser`, avec « L'atelier est désormais la source des mots : relancer l'import écraserait son travail. Pour le faire quand même : npm run import -- --ecraser ».

- [ ] **Step 1: Écrire la configuration et les scripts.**
- [ ] **Step 2: Vérifier** — `npm run import` s'arrête avec le message et `git -C donnees status --short` est vide ; `node scripts/maj-donnees.mjs` dit la date de la liste ; `npm run package:desktop` produit les deux fichiers ; le portable, lancé avec `JOLISMOTS_DEPOT` et `JOLISMOTS_DONNEES` de la tâche 16, s'ouvre sur un mot et l'Atelier montre la liste. L'installeur n'est pas lancé par un agent : c'est une étape de Philippe.
- [ ] **Step 3: Commit** — `git commit -m "Windows : installeur et version portable, liste embarquée à jour, import gardé"`

### Task 18: Documentation et version 1.0.0

**Files:**
- Modify: `package.json` et les `package.json` des paquets (`1.0.0`), `package-lock.json`, `CHANGELOG.md`, `README.md`, `PROJET.md`, `VERSIONING.md`, `CLAUDE.md`, `scripts/captures.mjs`, `docs/captures/*`

Écrire seulement ce que le code montre (consigne du `CLAUDE.md`).

- **`CHANGELOG.md`**, section `## [1.0.0] - <date du jour>` et sa ligne de lien. Contenu, en langage simple :
  - *Ajouté* : l'application Windows (installeur et version portable) avec les écrans Mot, Quiz, Recueil ; l'atelier (liste de tous les mots avec recherche et filtres Tous, Complets, À compléter, Doublons ; fiche à remplir ; aperçu ; bouton vers le CNRTL ; « Envoyer au téléphone ») ; le quiz au choix (« Tous les mots » ou « Les mots que j'ai vus ») et le réglage du nombre de questions ; les filtres Rollin et Méral du Recueil.
  - *Modifié* : la lecture n'a plus de séance ni de compteur, et l'écran Mot ne propose plus le quiz ; une bonne réponse ne fait avancer un mot que s'il est à revoir ; les filtres du Recueil tiennent sur une ligne, et toucher le filtre allumé l'éteint ; l'application reste en portrait ; **l'APK est signé avec une nouvelle clé : il faut désinstaller la version 0.1.0 avant d'installer celle-ci, ce qui efface les progrès et les favoris du téléphone, une seule fois.**
  - *Corrigé* : le texte placé avant le premier sens (« Éployer », « Musarder ») ; les longues indications difficiles à lire en petites capitales ; l'éclair clair au lancement en mode sombre ; le clavier dans les volets ; un téléphone ne peut plus adopter une liste vide ou aux identifiants en double.
- **`README.md`** : installer sous Windows (les deux fichiers ; Windows signale un éditeur inconnu, l'application n'étant pas signée) ; utiliser l'atelier ; le quiz et les filtres tels qu'ils sont ; la désinstallation unique sur Android ; le résumé en anglais mis à jour.
- **`PROJET.md`** : le paquet `apps/desktop`, le pont, le dépôt local et ses règles, `atelier.ts` et `envoi.ts`, les règles de mémoire et du quiz, la signature (fichier de clé, variables, commande `keytool`), le portrait, les nouvelles commandes, `JOLISMOTS_DEPOT` et `JOLISMOTS_DONNEES`, l'import gardé.
- **`VERSIONING.md`**, étape 7 : les trois fichiers à joindre (`Jolis-Mots-X.Y.Z.apk`, `-setup.exe`, `-portable.exe`). **`CLAUDE.md`** : les commandes `build:desktop`, `start:desktop`, `package:desktop`, `package:android:debug`, et la règle « aucun essai n'envoie sur `donnees` ».
- **Captures** : `quiz.png` devient l'écran du choix ; `question.png` (nouveau) par `?quiz=vus&mot=baguenauder#quiz` ; `atelier.png` (nouveau), 1280 × 800, par `?pont=demo&mot=venuste#atelier` avec le mot « Vénuste » choisi ; les autres sont refaites.

- [ ] **Step 1: Mettre les versions à `1.0.0`** et relancer `npm install` pour le fichier de verrouillage.
- [ ] **Step 2: Écrire la documentation et le journal.**
- [ ] **Step 3: Refaire les captures** — `npm run captures` ; regarder chaque image.
- [ ] **Step 4: Vérifier** — `npm test` et `npm run check` passent ; l'écran Réglages affiche « 1.0.0 » ; chaque commande citée dans la documentation existe dans un `package.json` ; aucun lien mort dans le README.
- [ ] **Step 5: Commit** — `git commit -m "Jolis Mots 1.0.0 : documentation, journal et captures"`

### Task 19: Vérification d'ensemble et demande de fusion

Tâche du contrôleur, après la relecture finale de la branche.

- [ ] **Step 1: Tout relancer** — `npm test`, `npm run check`, `npm run package:desktop`, et depuis PowerShell `npm run package:android:debug`, installé sur l'émulateur : parcours Mot, Quiz (les deux choix), Recueil (filtres, fiche), Réglages.
- [ ] **Step 2: Vérifier que rien n'est parti** — `git ls-remote origin donnees` rend toujours le commit du début du travail ; `git status` ne montre ni `vocabulaire.xlsx` ni fichier de clé.
- [ ] **Step 3: Ouvrir la demande de fusion** — `git push -u origin release/jolis-mots-v1.0.0`, puis `gh pr create --base main --title "Jolis Mots 1.0.0 : Windows et atelier" --body-file <section 1.0.0 du journal>`. Donner le lien à Philippe. **Ne rien fusionner, ne rien étiqueter.**

---

## Ce que Philippe fait lui-même

Aucun agent ne peut le faire à sa place. Rien de tout cela ne bloque la demande de fusion ; les points 1 et 2 sont nécessaires avant « publie », pour joindre l'APK signé à la version.

1. **Créer la clé de signature**, dans un terminal : `npm run cle:android` (ajouté pendant la construction, à la place de la commande `keytool` brute de la tâche 9, qui dépendait du terminal utilisé). La commande demande un mot de passe et un nom, et refuse d'écraser une clé existante. Garder le mot de passe dans son gestionnaire de mots de passe et une copie du fichier `jolis-mots.jks` ailleurs que sur cette machine : sans eux, aucune mise à jour future ne pourra s'installer par-dessus.
2. **Fabriquer l'APK signé**, depuis PowerShell : `npm run package:android`, en tapant le mot de passe quand `apksigner` le demande.
3. **Sur le téléphone** : désinstaller la 0.1.0, installer la 1.0.0, vérifier que les filtres du Recueil tiennent sur une ligne et qu'il n'y a pas d'éclair au lancement.
4. **Installer la version Windows** avec `Jolis-Mots-1.0.0-setup.exe`.
5. **Le premier vrai envoi** : dans l'atelier, corriger un mot, « Envoyer au téléphone », puis rouvrir l'application du téléphone quelques minutes plus tard.

## Laissé hors de ce plan

Points de la relecture de la 0.1.0 jugés sans effet visible, à reprendre plus tard si besoin : les recherches de genre sur un objet simple (`constructor`), les tests manquants de `memoire.ts` hors des règles réécrites ici, l'essai de la navigation à trois boutons, le nettoyage d'Edge quand `captures.mjs` échoue à son démarrage, l'icône de la barre d'état qui change avec 0,2 à 0,4 s de retard, la bande d'une autre couleur avec une palette imposée sur une WebView ancienne.

Le Play Store (conception, section 13.5) n'est pas dans cette version.
