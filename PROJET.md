# Jolis Mots : notes techniques

Ce document décrit le dépôt tel qu'il est à la version 0.1.0. La [conception](docs/superpowers/specs/2026-11-24-jolis-mots-design.md) dit pourquoi ; ici, on dit comment. Pour utiliser l'application, voir le [README](README.md).

## Vue d'ensemble

Tout est en TypeScript, dans un dépôt `npm` à plusieurs paquets (workspaces) :

| Paquet | Dossier | Rôle |
| --- | --- | --- |
| `@jolis-mots/core` | `packages/core` | Toute la logique, sans interface : lecture des définitions, mémoire, quiz, recherche, format du fichier, import. Testée avec Vitest. |
| `@jolis-mots/web` | `apps/web` | L'application : Svelte 5 et Vite. C'est elle qui est affichée, sur Android comme dans un navigateur. |
| `@jolis-mots/android` | `apps/android` | L'enveloppe Android : Capacitor emballe la construction de `apps/web` dans un APK. |

À côté : `tools/import` (import depuis l'Excel), `scripts/captures.mjs` (captures d'écran du README), `version.ts` (numéro de version, lu par Vite).

Le cœur est livré en TypeScript (`"exports": "./src/index.ts"`) : Vite le transforme comme le code de l'application, il n'y a pas d'étape de compilation séparée.

## Le cœur (`packages/core/src`)

| Fichier | Contenu |
| --- | --- |
| `types.ts` | `Mot`, `FichierMots`, `estComplet`. |
| `definition.ts` | `lireDefinition`, `developperIndication`. |
| `genre.ts` | `developperGenre` (« subst. masc. » devient « nom masculin »), `premierTerme`, `genreEstConnu`. |
| `sources.ts` | `lireSource`, `auteursDe`, `afficherPages`, `auteursParNombre`. |
| `recherche.ts` | `normaliser`, `ordonner`, `lettrine`, `filtrer`. |
| `typographie.ts` | `embellir` (apostrophe courbe, points de suspension), `entreGuillemets`, `tailleDuMot`. |
| `fichier.ts` | `ecrireFichier`, `validerFichier`, `comparerMots`, `creerId`. |
| `memoire.ts` | `marquerVu`, `marquerMontre`, `repondre`, `motsDus`, `INTERVALLES`. |
| `selection.ts` | `prochainMot`. |
| `quiz.ts` | `composerQuiz`, `definitionPourQuiz`. |
| `miseAJour.ts` | `ADRESSE_LISTE`, `choisirListe`. |
| `stockage.ts` | `lireJson`. |
| `import.ts` | `importer`, `rapportEnMarkdown`. |

Chaque fichier a son `.test.ts` à côté.

Un mot est **complet** quand sa définition n'est pas vide et que `aCompleter` est faux. Seuls les mots complets apparaissent dans les écrans Mot, Quiz et Recueil.

### Le fichier `mots.json`

```json
{
  "format": 1,
  "publie": "2026-11-24T14:53:21Z",
  "mots": [
    {"id":"j3mwbn","mot":"Baguenauder","tri":"baguenauder","genre":"verbe","definition":"1. Passer son temps … SYN: muser.\n2. [Par ext.] Se promener …","sources":["Sylvain Tesson: Sur les chemins noirs"],"note":"","util":"LL","aCompleter":false}
  ]
}
```

- `format` vaut 1. `publie` est une date ISO : c'est elle qui décide quelle liste est la plus récente.
- Un mot par ligne, dans l'ordre de `tri` (sans accents ni majuscules), puis de `mot`. Ainsi l'historique git de la branche `donnees` montre ligne par ligne ce qui change.
- `id` : six caractères parmi `a-z0-9`, tirés par `creerId`. Un mot garde son identifiant, car les progrès sur l'appareil s'y rattachent.
- `mot` est le mot tel qu'affiché (« S'abolir ») ; `tri` sert au classement et à la recherche (« abolir »).
- `genre` : nature grammaticale abrégée (`adj.`, `subst. masc.`, `verbe trans.`…), développée à l'affichage.
- `sources` : une ligne par livre, de la forme `Auteur: Titre (pages)`. Les pages sont facultatives (`82,319` s'affiche « p. 82, 319 »). Un livre à deux auteurs s'écrit `A & B: Titre` et compte pour chacun dans le filtre par auteur.
- `note` et `util` viennent de l'Excel ; l'application ne les affiche pas.
- `validerFichier` rend le fichier s'il a la bonne forme, sinon `null`.

Le texte saisi (`mot`, `definition`, `sources`…) n'est jamais modifié par l'affichage : l'embellissement typographique se fait à l'écran, sur une copie.

### Les conventions de définition et leur lecture

La définition est un texte brut. `lireDefinition` le découpe en sens, sans rien écarter : un texte hors conventions reste entier dans le champ `texte` d'un seul sens.

- **Sens numérotés** : si la première ligne non vide commence par `1.`, chaque ligne commençant par `2.`, `3.`… ouvre un sens, et les lignes qui suivent lui appartiennent. Une seule ligne faite d'une indication entre crochets peut précéder le `1.` (« [Argot] ») : elle devient l'indication du premier sens, ou, s'il a déjà la sienne, reste en tête de son texte. Sinon tout le texte forme un seul sens, sans numéro.
- **Indication** : un sens peut commencer par une indication entre crochets, `[Litt.]` ou `[Par ext.]`. Les crochets sont retirés, et `developperIndication` développe les abréviations connues (`Litt.` devient « Littéraire », `fig.` « Figuré », `par ext.` « Par extension », `fam.`, `péj.`, `pop.`, `vulg.`, `argot.`, `poét.`, `iron.`, `par anal.`, `par méton.`, `par métaph.`). Un terme inconnu reste tel quel.
- **Balises** : `EX:` (exemple), `SYN:` (synonymes, séparés par des virgules), `US:` (usage), `ANTON:` ou `ANT:` (antonymes). La balise est reconnue seulement au début d'un mot (pas dans « SEX: »). Plusieurs exemples sont possibles dans un même sens.

L'import vérifie, sur les définitions réelles, que la lecture ne perd aucun mot (voir plus bas).

## L'application web (`apps/web/src`)

### Écrans et composants

- `App.svelte` : en-tête, écran courant, barre d'onglets. L'écran se choisit par l'adresse (`#mot`, `#quiz`, `#recueil`, `#reglages`) ; sans adresse, c'est Mot.
- `ecrans/Mot.svelte` : la fiche du mot courant (`composants/Fiche.svelte`), un glissement horizontal de plus de 60 px pour changer de mot, l'étoile des favoris, « Mot suivant ». Quand la séance est finie, les boutons deviennent « Encore un mot » et « Passer au quiz ».
- `ecrans/Quiz.svelte` : voir plus bas.
- `ecrans/Recueil.svelte` : la liste alphabétique avec lettrines, la recherche, les filtres (Tous, Bouvier, Tesson, Favoris, et un volet « Autres auteurs » avec le nombre de mots de chacun), la fiche ouverte dans un volet.
- `ecrans/Reglages.svelte` : mots par séance, palette, version, date de la liste, « Effacer mes progrès » (avec confirmation).
- `composants/Entete.svelte`, `composants/Onglets.svelte` : l'en-tête (avec « 2 sur 5 » sur l'écran Mot) et les trois onglets.

L'état de l'application est dans `etat.svelte.ts` (une classe avec les runes de Svelte 5). Les écrans n'ont pas d'état partagé ailleurs.

Sur la fiche, les retours à la ligne saisis dans le texte d'un sens, un exemple ou un usage restent visibles (`white-space: pre-line`).

Une seule police, EB Garamond, embarquée par `@fontsource/eb-garamond` ; aucune ressource n'est chargée d'un CDN. Les couleurs sont six variables CSS (`--papier`, `--encre`, `--second`, `--filet`, `--exemple`, `--accent`), posées selon la palette par l'attribut `data-palette` de la page. Aucun composant n'écrit de couleur en dur. Les cibles tactiles font au moins 44 px.

### Palettes et réglages

Cinq choix : `systeme` (Papier le jour, Nuit quand l'appareil est en mode sombre), `papier`, `nuit`, `ivoire`, `ceruleen`. Le choix `systeme` est celui de départ.

Les réglages sont deux valeurs : `motsParSeance` (5, 6, 8 ou 10, 5 par défaut ; une valeur qui n'est pas un nombre est ramenée à 5, un nombre à la plus petite taille permise qui le contient, ou à 10 au-delà) et `palette`.

### Adresses de développement

`etat.demarrer` lit l'adresse au premier affichage :

- `?mot=ceruleen` impose le premier mot (comparé au mot entier, puis au tri, sans accents ni majuscules) ;
- `?palette=nuit` impose la palette, sans l'enregistrer ;
- `#quiz`, `#recueil`, `#reglages` ouvrent l'écran voulu.

C'est ce qu'utilise `scripts/captures.mjs`.

### Ce que l'appareil garde

Dans `localStorage`, quatre clés (voir `stockage.ts`) : `jolismots.progres.v1`, `jolismots.favoris.v1`, `jolismots.reglages.v1`, `jolismots.liste.v1` (la dernière liste téléchargée). Une valeur absente, illisible ou d'une autre forme est remplacée par la valeur par défaut ; un stockage plein ou refusé est ignoré.

La séance en cours, les mots déjà interrogés et la position vivent en mémoire seulement : ils repartent à zéro à chaque lancement.

### Mémoire et quiz

**Mémoire** (`memoire.ts`). Chaque mot vu a un état : date de dernière vue sur l'écran Mot, case (1 à 5), échéance, et « acquis ».

- Un mot vu entre en case 1, dû un jour plus tard.
- Les délais par case sont 1, 3, 7, 16 et 35 jours (`INTERVALLES`).
- Une bonne réponse monte d'une case et fixe la nouvelle échéance. Une bonne réponse en case 5 rend le mot acquis : il ne revient plus.
- Une mauvaise réponse ramène le mot en case 1, dû un jour plus tard, et lui retire « acquis ».
- `motsDus` rend les mots non acquis dont l'échéance est passée, du plus ancien au plus récent.

**Choix du mot suivant** (`selection.ts`). Au hasard parmi les mots complets jamais vus (absents des progrès et de la séance) ; quand tous ont été vus, le mot vu le plus anciennement hors de la séance. Un mot montré est marqué vu aussitôt (`marquerMontre`) : un mot nouveau entre en case 1, un mot connu reçoit seulement une nouvelle date de vue, sans changer de case ni d'échéance. Les mots déjà vus reviennent ainsi chacun à son tour.

**Séance.** Elle compte 5 mots par défaut (réglable). Une fois la taille atteinte, l'écran Mot propose « Encore un mot » ou « Passer au quiz ».

**Quiz** (`quiz.ts`, `Quiz.svelte`). Il est composé une seule fois, à l'ouverture de l'écran, pour que répondre ne le recompose pas.

- Il interroge d'abord chaque mot de la séance pas encore interrogé, puis au plus cinq mots dus (`DUS_MAX`) qui ne sont pas dans la séance. Un mot déjà interrogé dans la séance n'est pas reposé.
- Les formes alternent, en commençant par « quel mot correspond à cette définition ? » puis « que veut dire ce mot ? ». Chaque question a quatre choix : la bonne réponse et trois mauvaises, tirées de préférence parmi les mots de même genre, sinon de même premier terme de genre, sinon de n'importe quel mot complet. Ne sont jamais proposés comme mauvaises réponses, puisqu'ils seraient justes eux aussi : les synonymes du bon mot, un mot de même `mot` (sans majuscules ni accents) et un mot de même texte posé au quiz. Deux choix ne montrent jamais le même texte.
- Le texte posé est le premier texte non vide de la définition, avec le mot (et son tri) remplacé par « — ». Quand toute la définition est une liste de synonymes, le mot est interrogé par ses synonymes (« Synonymes : … »). Sans texte ni synonymes, le mot n'est pas interrogé.
- Une réponse enregistre le résultat dans la mémoire. L'écran dit « Juste. » ou donne la bonne réponse, sans score ni série. À la fin : « C'est tout pour cette fois », ou « Rien à réviser aujourd'hui » quand il n'y avait aucune question.

### Mise à jour de la liste en ligne

La liste des mots est publiée sur la branche `donnees` du dépôt, fichier `mots.json`. Cette branche ne contient que ce fichier et n'est jamais fusionnée dans `main`.

- Une copie de la liste est **embarquée** dans l'application à la fabrication (`liste-embarquee.ts` importe `donnees/mots.json` ; elle pèse plus de 700 ko). L'application montre donc ses mots sans réseau.
- Au démarrage, `miseAJour.ts` demande `https://raw.githubusercontent.com/iago-swi/jolis-mots/donnees/mots.json` (sans cache, abandon au bout de 8 secondes). Sans réseau, sur une erreur ou une réponse inutilisable, il ne fait rien et ne dit rien.
- `choisirListe` ne retient la liste reçue que si elle a la bonne forme, une date `publie` lisible et plus récente que celle en place. Elle est alors gardée sur l'appareil (`jolismots.liste.v1`) et adoptée au prochain mot tiré, jamais au milieu d'un mot affiché.
- Au lancement suivant, la liste gardée est préférée à l'embarquée si elle est valide et plus récente.

## L'enveloppe Android (`apps/android`)

- Capacitor 8.6.2 ; identifiant `ch.noth.jolismots`, nom « Jolis Mots », `webDir` : `../web/dist`. Les chemins de l'application sont relatifs (`base: './'`), elle s'ouvre donc aussi bien d'un serveur que du paquet embarqué.
- Dans l'application Android seulement (`main.ts`), le bouton retour ferme d'abord la fiche ou le volet ouvert, puis les réglages, puis revient à l'écran Mot ; depuis Mot, il quitte.
- `make-icons.mjs` dessine l'icône (les lettres « jm » en EB Garamond italique, changées en tracés) dans `assets/icone.svg`, écrit les icônes du lanceur, et remplace les images de l'écran de lancement par un fond papier avec la marque au centre. Il tourne dans `npm run package:android`.
- `build-apk.mjs` fabrique l'APK (voir plus bas). `versionName` est le numéro du `package.json` racine ; `versionCode` vaut majeure × 10 000 + mineure × 100 + correctif (0.1.0 donne 100).
- Le dossier `apps/android/android/` est **généré** par Capacitor et ignoré par git. Après un clonage neuf : `npx cap add android`, lancé depuis `apps/android`.
- L'APK est signé avec la clé de débogage : il convient à une installation directe, pas au Play Store (voir « Signature » plus bas).

### Barres du système

Android 16 impose l'affichage bord à bord : la page peut passer sous la barre d'état et sous la barre de gestes.

- **Configuration** (`capacitor.config.ts`) : le greffon `SystemBars` de Capacitor reçoit `insetsHandling: 'css'` et `initialViewportFitValueHint: 'cover'` ; `index.html` demande aussi `viewport-fit=cover`. Capacitor donne alors à la page la hauteur des barres dans `--safe-area-inset-top` et `--safe-area-inset-bottom`.
- **Marges** (`app.css`) : `--marge-haut` et `--marge-bas` reprennent ces valeurs, à défaut `env(safe-area-inset-*)`, sinon zéro dans un navigateur ordinaire. L'en-tête commence sous la barre d'état (`Entete.svelte`) et les onglets restent au-dessus de la barre de gestes (`Onglets.svelte`) ; le fond de la page s'étend sous les deux.
- **Bord à bord ou non** (`apps/web/src/barres.ts`) : `webViewBordABord` lit la version de Chromium dans l'agent utilisateur. Capacitor ne met la WebView bord à bord qu'à partir de Chromium 140 ; avant, il la décale sous les barres, qui restent posées sur le fond de la fenêtre Android. Sans version lisible, la WebView est tenue pour bord à bord.
- **Couleur des icônes** (`main.ts`, `etat.suivreFondDesBarres`) : les icônes de la barre d'état et de la barre de gestes sont claires sur un fond sombre et sombres sur un fond clair (`SystemBars.setStyle`). Sur une WebView récente (bord à bord), le fond est celui de la palette affichée : les icônes suivent la palette (Nuit, ou « Comme le système » en mode sombre). Sur une WebView d'avant Chromium 140, le fond est celui de la fenêtre : les icônes suivent le mode de l'appareil. Elles changent aussitôt quand la palette ou le mode change.
- **Fond de la fenêtre** : `make-icons.mjs` écrit la couleur `fond_fenetre` (le papier de Papier dans `values`, celui de Nuit dans `values-night`) et l'ajoute comme `android:windowBackground` au thème `AppTheme.NoActionBar` de `styles.xml`. Sur une WebView d'avant Chromium 140, les barres sont donc posées sur le papier de Papier le jour et sur celui de Nuit en mode sombre, comme « Comme le système ».

### Signature

L'APK fabriqué par `npm run package:android` est un APK de débogage, signé avec la clé de débogage de la machine qui le fabrique : le fichier `%USERPROFILE%\.android\debug.keystore`, créé par les outils Android à la première fabrication.

Android ne met à jour une application installée qu'avec un APK signé par la même clé. Un APK fabriqué sur une autre machine, ou après la perte de ce fichier, ne s'installe qu'après avoir désinstallé l'application, ce qui efface les progrès et les favoris gardés sur le téléphone. Ce fichier doit donc être sauvegardé.

## Import depuis l'Excel (`tools/import`)

`npm run import` fait deux choses, depuis la racine :

1. `extraire.py` (Python et `openpyxl`) lit la feuille « Philippe » de `vocabulaire.xlsx` en lecture seule et écrit `tools/import/sortie/lignes.json` : une ligne par mot, avec les colonnes Mot, Tri, Genre, Définition, Note, Util., Source, et un indicateur pour les lignes remplies en rouge.
2. `importer.ts` appelle `importer` du cœur et écrit `donnees/mots.json` et le rapport `tools/import/sortie/rapport-import.md`.

Règles de l'import :

- Les groupes de trois dièses ou plus (`###`) sont retirés ; leur présence, ou une définition vide, marque le mot `aCompleter`.
- Les lignes de source sont séparées, les lignes vides et les tirets écartés.
- Deux lignes sont des doublons quand leur mot est le même, sans majuscules ni espaces en trop ; **les accents comptent**. Si une seule a une définition (ou aucune), les lignes vides sont écartées et leurs sources réunies, mais seulement si elles n'apportent rien d'autre : une ligne dont le genre, la note ou le Util. n'est ni vide ni identique à celui de la ligne gardée est gardée elle aussi, et le rapport la signale (« Doublons gardés parce qu'ils portent un genre, une note ou un Util. différent »). Si plusieurs ont une définition, toutes sont gardées.
- Les lignes rouges sont importées telles quelles, sans fusion, à départager à la main.
- Un mot retrouvé avec les mêmes `mot` et `tri` dans le `mots.json` existant garde son identifiant ; les autres en reçoivent un nouveau.
- Le fichier est écrit dans l'ordre de `tri`. Un contrôle vérifie que `lireDefinition` ne perd aucun mot des définitions réelles.

`vocabulaire.xlsx` est l'archive personnelle du propriétaire : il reste à la racine, hors de git, et n'est jamais modifié.

## Commandes

Toutes se lancent depuis la racine.

| Commande | Effet |
| --- | --- |
| `npm test` | Les tests (Vitest). |
| `npm run typecheck` | Contrôle des types (`tsc`). |
| `npm run build` | Fabrique l'application dans `apps/web/dist`. |
| `npm run check` | `typecheck`, puis `build`. |
| `npm run dev` | Serveur de développement sur `http://localhost:5173`. |
| `npm run import` | Import depuis l'Excel (voir plus haut). |
| `npm run build:android` | `build`, puis `cap sync android` et les icônes. |
| `npm run package:android` | `build:android`, puis l'APK dans `apps/android/release/Jolis-Mots-<version>.apk`. |
| `npm run captures` | Refait les captures du README dans `docs/captures/`. |

## Mettre en route après un clonage

1. `npm install`.
2. La liste des mots. `donnees/mots.json` est la branche `donnees`, montée en dossier de travail (worktree) et ignorée sur la branche de code. Sans elle, `typecheck` et `build` échouent :

   ```bash
   git worktree add donnees donnees
   ```

3. Pour Android seulement, le projet généré : `npx cap add android`, depuis `apps/android`.

## Fabriquer l'APK

`npm run package:android` demande :

- **Un JDK entre 17 et 24.** Gradle 8.14 ne démarre pas sur un Java plus récent, et le greffon Android veut au moins le 17. `build-apk.mjs` prend `JAVA_HOME` s'il convient, sinon cherche un JDK dans `C:\Program Files\Eclipse Adoptium`, `C:\Program Files\Java`, `C:\Program Files\Microsoft` ou `/usr/lib/jvm`, pour cette fabrication seulement. Sur cette machine : Temurin 21 (`winget install EclipseAdoptium.Temurin.21.JDK`). Sans JDK convenable, le script s'arrête en le disant.
- **Le SDK Android**, dans `ANDROID_HOME` ou, à défaut, `C:\Android\Sdk`.
- **PowerShell sur cette machine.** Lancée depuis Git Bash, la fabrication Gradle échoue (« Unable to establish loopback connection »). Lancer la commande depuis PowerShell.

L'APK fabriqué est un APK de débogage (`assembleDebug`). `node apps/android/build-apk.mjs --release` fabrique un APK non signé ; cette variante n'est pas branchée sur une commande `npm`.

## Captures d'écran

`npm run captures` fabrique l'application, la sert sur un port local libre, la photographie avec Edge sans fenêtre (piloté par son protocole de débogage), puis écrit `mot.png`, `quiz.png`, `recueil.png`, `reglages.png` et `palettes.png` dans `docs/captures/`. Edge sans fenêtre ne descend pas sous 500 px de large : le script émule donc un écran de 390 × 844 px, et impose le mode clair, car les pastilles « Comme le système » des Réglages suivent le mode sombre de la machine. Les adresses fixent le mot (`?mot=baguenauder`) et la palette (`?palette=papier`). L'écran Quiz montre la question du seul mot de la séance ; les trois mauvaises réponses sont tirées au hasard, elles changent d'une exécution à l'autre.

## Versions et publication

Une seule version pour tout le dépôt, dans le `package.json` racine. `version.ts` la donne à Vite, qui l'écrit dans l'application (écran Réglages) et dans la balise `<meta name="version">`. Les règles de numérotation et de publication sont dans [VERSIONING.md](VERSIONING.md) ; le flux `.github/workflows/release.yml` publie sur GitHub la section du [journal](CHANGELOG.md) à chaque étiquette `vX.Y.Z`.
