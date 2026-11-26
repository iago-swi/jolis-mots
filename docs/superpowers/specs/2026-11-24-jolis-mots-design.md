# Jolis Mots : conception

Date : 24 novembre 2026. Statut : validée par Philippe, puis révisée le même jour pour la version 1.0.0 (section 13).

Dans ce document, « décidé par Philippe » signale ce qu'il a dit lui-même. Tout le reste est une proposition de Claude, qu'il peut corriger.

## 1. Intention

Philippe est traducteur (français langue maternelle). Il a rassemblé dans un fichier Excel environ 2 500 mots français rares ou beaux, relevés dans des dictionnaires de mots rares et chez des écrivains comme Nicolas Bouvier et Sylvain Tesson.

Il veut une application qui lui fasse **apprendre ces mots dans les moments creux** : il attend le bus, il ouvre Jolis Mots, un mot s'affiche tout de suite, il en lit cinq ou six, puis un quiz l'aide à les retenir. L'interface doit être belle : c'est un objet pour quelqu'un qui aime la langue.

Deux formes, décidées par Philippe :

- **Android**, la plus importante : lire, apprendre, réviser.
- **Windows** : la même chose, plus un **atelier** pour ajouter, modifier et supprimer des mots.

Le nom exact est **Jolis Mots**.

## 2. Buts, non-buts, anti-buts

### Buts

1. À l'ouverture, un mot est à l'écran en moins d'une seconde, sans réseau, sans menu à traverser.
2. Une lecture tient dans une attente de bus : on lit autant de mots qu'on veut, et le quiz est un choix, jamais une étape imposée (révisé pour la 1.0.0, section 13).
3. Le quiz fait revenir les mots jusqu'à ce qu'ils tiennent.
4. La fiche d'un mot est une belle page typographique.
5. L'atelier permet d'avancer vite dans les 1 396 fiches encore sans définition.
6. Une modification faite dans l'atelier arrive sur le téléphone par un seul bouton.

### Non-buts (pas dans cette version)

- Comptes, plusieurs utilisateurs.
- Synchronisation des progrès entre le téléphone et Windows : chaque appareil garde les siens.
- Notifications, widget « mot du jour ».
- Récupération automatique des définitions sur le CNRTL (un bouton ouvre seulement la page du mot).
- iOS, publication sur le Play Store, version jouable dans le navigateur. Pour le Play Store, voir la section 13.5.
- Import des autres feuilles de l'Excel (« Ariane », « Util. VS1 », etc.).
- Interface dans une autre langue que le français.
- Export de la base vers Excel.

### Anti-buts (ce qui serait un échec même si ça « marche »)

- Une application qui s'ouvre sur un menu, ou qui a besoin du réseau pour montrer un mot.
- Un habillage de jeu : points, confettis, séries à ne pas rompre.
- Perdre ou altérer le texte de Philippe. Le texte qu'il a saisi reste la référence, mot pour mot.
- Attribuer à l'auteur de la source une phrase d'exemple qui vient du CNRTL.

## 3. Les données de départ

Fichier `vocabulaire.xlsx`, feuille « Philippe » (table `Mots`), 2 552 lignes. Signification des colonnes, donnée par Philippe :

| Colonne | Rôle | Remplie |
| --- | --- | --- |
| Mot | Le mot ou l'expression, tel qu'affiché (« S'abolir », « Sans ambages »). | 2 552 |
| Tri | Version raccourcie en minuscules, pour le classement : le verbe sans son pronom, le mot central d'une expression. | 2 552 |
| Genre | Nature grammaticale (`adj.`, `subst. masc.`, `verbe trans.`…). | 1 156 utiles |
| Définition | La ou les définitions, d'après cnrtl.fr. | 1 156 |
| Note | Pour marquer les mots les plus intéressants. | 2 |
| Util. | Pour noter qu'il a employé le mot dans un des livres qu'il publie (codes `L`, `LL`, `LLL`, `X`). | 189 |
| Source | Où il a trouvé le mot, quand il le sait : `Auteur: Titre (pages)`, une ligne par livre. | 1 966 |

Les **dièses** (`###`, seuls ou accolés au genre, 1 396 lignes) marquent les mots notés à la hâte, sans définition.

Constatations sur le contenu :

- La définition suit des conventions régulières : sens numérotés (`1.`, `2.` en début de ligne), indications entre crochets (`[Fig.]`, `[Litt.]`, `[Vieux]`, `[Par ext.]`…), et des balises `EX:` (exemple, 540 fiches), `SYN:` (synonymes, 383), `US:` (usage, environ 130), `ANT:` ou `ANTON:` (antonymes, rares).
- Les phrases après `EX:` viennent du CNRTL. Elles ne sont pas tirées du livre indiqué dans Source.
- Quelques définitions sont des copies brutes du CNRTL qui ne suivent pas ces conventions (la plus longue fait 1 200 caractères).
- 44 mots figurent en double, le plus souvent une ligne `###` vide à côté d'une ligne complète. Certains mots finissent par une espace insécable. 66 sources valent `-`.
- 41 lignes ont un fond rouge. D'après Philippe, ce sont des doublons pour lesquels il n'a pas encore décidé laquelle garder.
- Pour 22 lignes, le dièse et la colonne Définition ne disent pas la même chose :
  - 8 ont un genre rempli et `###` pour toute définition (Cahin-caha, Quitus, Mesmériser…) ;
  - 11 marquées `###` portent une note rapide en guise de définition : `(biere)`, `(argent)`, `### couleur ?`, ou une liste de mots à ajouter sous « In fine » ;
  - 3 marquées `###` ont une vraie définition (Hiémal, Ithyphallique, Maïeutique).

## 4. Approches envisagées

La question ouverte était : comment un mot modifié dans l'atelier arrive-t-il sur le téléphone ?

1. **Publication en ligne.** Un bouton de l'atelier dépose la liste sur GitHub ; le téléphone la récupère à l'ouverture quand il a du réseau et fonctionne hors ligne sinon. Chaque envoi est une sauvegarde datée. Contrepartie : la liste est lisible par quiconque connaît l'adresse.
2. **Transfert par fichier.** L'atelier exporte un fichier, à copier sur le téléphone et à importer. Privé, mais une manipulation à chaque fois.
3. **Tout dans l'application.** Les mots sont figés dans l'APK ; chaque correction demande de reconstruire et de réinstaller. Écartée : il reste 1 396 fiches à compléter.

**Décidé par Philippe : l'approche 1, publication en ligne.**

## 5. Ce que l'application fait

Une maquette cliquable montre les quatre écrans : <https://claude.ai/artifact/LxdiEbwncpkrHm3hXcXHs1> (privée). Ses fichiers sont copiés dans `docs/superpowers/specs/maquette/`. La maquette fait foi pour l'allure générale, ce document pour le comportement.

L'application a trois écrans sur le téléphone (Mot, Quiz, Recueil), reliés par une barre en bas. Sous Windows s'y ajoute l'Atelier.

### 5.1 Écran « Mot » (écran d'ouverture)

L'application s'ouvre directement ici, sur un mot.

La fiche montre, de haut en bas : la nature du mot en toutes lettres (section 6.6), le mot en grand, puis chaque sens avec son numéro, son indication (littéraire, figuré…), son texte, ses synonymes et son exemple en italique entre guillemets. En bas, sous le titre « Rencontré chez », la liste des sources : auteur et titre en italique, sans les pages (décidé par Philippe pour la 1.0.1). Le mot est composé à une seule grande taille ; une expression passe à la ligne entre ses mots. Seul un mot d'un seul tenant trop long pour une ligne prend une seconde taille, plus petite : deux tailles, jamais un dégradé (décidé par Philippe pour la 1.0.0).

- Seuls les mots **complets** apparaissent sur les écrans Mot, Quiz et Recueil. Un mot est complet quand sa définition est remplie et qu'il n'est pas marqué « à compléter » (section 6.1).
- **Mot suivant** passe au mot suivant ; un glissement vers la gauche fait de même, vers la droite revient au mot précédent, parmi ceux montrés depuis l'ouverture de l'application.
- La lecture n'a pas de fin : il n'y a ni séance, ni compteur, et l'écran Mot ne propose pas le quiz (décidé par Philippe pour la 1.0.0 ; la séance de 5 mots de la version 0.1.0 disparaît).
- Choix du mot : au hasard parmi les mots complets jamais montrés sur cet écran. Quand tous l'ont été, ceux montrés il y a le plus longtemps. Un mot rencontré seulement dans un quiz reste à lire : il compte ici comme jamais montré.
- L'**étoile** marque un favori. Les favoris sont gardés sur l'appareil.
- Une fiche plus longue que l'écran défile ; les boutons restent visibles en bas.

### 5.2 Écran « Quiz »

L'onglet Quiz s'ouvre sur un choix (décidé par Philippe pour la 1.0.0) :

- **Tous les mots** : les questions sont tirées au hasard parmi tous les mots complets.
- **Les mots que j'ai vus** : les questions portent sur les mots déjà vus et pas encore acquis. Ceux qui sont dus pour une révision passent d'abord, du plus ancien au plus récent ; les autres suivent, au hasard.

Chaque choix affiche le nombre de mots qu'il couvre. Tant qu'aucun mot n'a été vu, le second est grisé, avec une phrase qui l'explique.

Un quiz compte 10 questions, ou 5, 15 ou 20 selon les réglages ; moins si le choix couvre moins de mots. À la fin, l'écran propose un autre quiz ou le retour à la lecture. Quitter l'onglet abandonne le quiz en cours ; les réponses déjà données restent enregistrées.

Deux formes de question, quatre réponses au choix :

- une définition est donnée, il faut trouver le mot ;
- un mot est donné, il faut trouver sa définition.

Règles :

- La définition montrée est le texte du premier sens, sans exemple. Si le mot lui-même y figure, il est remplacé par un tiret long.
- Les mauvaises réponses sont tirées parmi les mots complets de même nature grammaticale, et jamais parmi les synonymes déclarés de la bonne réponse. « Même nature » veut dire le même Genre exact ; s'il n'y en a pas assez, le même premier terme du Genre (`adj.`, `subst.`, `verbe`…) ; à défaut, n'importe quel mot complet.
- Après la réponse, la bonne est mise en évidence, la mauvaise barrée. La différence ne repose pas sur la seule couleur.
- **Mémoire** : cinq cases, à la manière des boîtes de Leitner. Un mot vu entre en case 1 ; « vu » veut dire montré sur l'écran Mot ou rencontré dans un quiz. Il redevient dû après 1, 3, 7, 16 puis 35 jours selon sa case.
  - Une bonne réponse sur un mot **dû** le fait monter d'une case. En case 5, elle le déclare acquis : il sort du quiz « Les mots que j'ai vus ».
  - Une bonne réponse sur un mot qui n'est **pas encore dû** ne change rien : refaire un quiz le même jour ne fait pas brûler les étapes.
  - Une mauvaise réponse renvoie le mot en case 1, qu'il soit dû ou non, acquis ou non.
  - Un mot jamais vu, rencontré dans « Tous les mots », entre en case 1 quelle que soit la réponse.

Le ton reste sobre : « Juste. » ou « C'était *baguenauder*. », sans score ni récompense.

### 5.3 Écran « Recueil »

La liste alphabétique des mots complets, classée selon la colonne Tri, avec une lettrine par lettre. Chaque ligne montre le mot, sa nature et le début de sa définition.

- **Recherche** sur Mot et Tri, sans tenir compte des accents ni des majuscules.
- **Filtres** (décidé par Philippe pour la 1.0.0) : de petits boutons qui tiennent sur une seule ligne d'un téléphone de 411 px de large : Bouvier, Tesson, Rollin, Favoris et « Autres » (Méral est passé sous « Autres » à la 1.0.1, décidé par Philippe, pour laisser la place au nom d'un autre auteur), qui ouvre la liste complète des auteurs, classée par nombre de mots. Il n'y a pas de bouton « Tous » : toucher le filtre allumé l'éteint. Si les six libellés ne tiennent pas en toutes lettres, Favoris est remplacé par l'étoile de l'écran Mot.
- Toucher une ligne ouvre la fiche du mot.

### 5.4 Écran « Atelier » (Windows seulement)

Trois colonnes, comme sur la maquette.

**À gauche, la liste** de tous les mots, complets ou non, avec recherche et quatre filtres munis de compteurs : Tous, Complets, À compléter, Doublons. Le filtre Doublons réunit les mots qui partagent leur Mot ou leur Tri avec un autre, rangés côte à côte, pour que Philippe choisisse lequel garder. Un bouton « Nouveau mot ».

**Au centre, la fiche** à remplir : Mot, Tri, Genre, Définition, Source, Note, Util.

- Tri est proposé automatiquement à partir de Mot (minuscules, pronom ou article initial retiré) et reste modifiable.
- Genre est un champ libre avec les valeurs déjà utilisées en suggestion.
- Définition est une zone de texte où Philippe écrit comme dans l'Excel, avec ses balises.
- Source prend une ligne par livre, au format `Auteur: Titre (pages)`.
- Une case **À compléter** tient le rôle des dièses de l'Excel. Tant qu'elle est cochée, le mot reste dans l'atelier et n'apparaît pas sur le téléphone, même si un début de définition est saisi. Elle est cochée d'office pour un nouveau mot.
- **Ouvrir dans le CNRTL** ouvre `https://www.cnrtl.fr/definition/<tri>` dans le navigateur. L'application ne lit pas la page.
- **Enregistrer** écrit la fiche. **Supprimer ce mot** demande confirmation.
- Un avertissement apparaît si le Mot ou le Tri existe déjà.
- Quitter une fiche modifiée sans l'enregistrer demande confirmation.

**À droite, l'aperçu** : la fiche telle qu'elle apparaîtra sur le téléphone, mise à jour pendant la saisie.

**En haut, « Envoyer au téléphone »**, avec le nombre de modifications pas encore envoyées : le nombre de mots ajoutés, modifiés ou supprimés depuis la dernière liste envoyée. Voir la section 7.

### 5.5 Réglages

Un écran discret, accessible depuis l'en-tête : nombre de questions par quiz (5, 10, 15 ou 20 ; 10 au départ), palette (Papier, Nuit, Ivoire, Céruléen, ou « Comme le système » : Papier le jour, Nuit quand l'appareil est en mode sombre), version de l'application, date de la dernière liste reçue, et un bouton pour effacer les progrès de l'appareil (avec confirmation).

## 6. Les données dans l'application

### 6.1 Le fichier des mots

Une seule liste fait référence : `mots.json`.

```json
{
  "format": 1,
  "publie": "2026-11-24T10:00:00Z",
  "mots": [
    {
      "id": "k3f9x2",
      "mot": "S'abolir",
      "tri": "abolir",
      "genre": "verbe pronom.",
      "definition": "Cesser d'être, d'exister. EX: Tes purs adorateurs…",
      "sources": ["Nicolas Bouvier: Le Poisson-Scorpion (172)"],
      "note": "",
      "util": "",
      "aCompleter": false
    }
  ]
}
```

- `id` est attribué à la création du mot et ne change jamais, même si le mot est renommé. Les progrès et les favoris s'y rattachent.
- `definition` garde **le texte brut**, tel que Philippe l'a saisi.
- `aCompleter` reprend le dièse de l'Excel. Un mot est **complet** quand `definition` n'est pas vide et que `aCompleter` est faux. Le filtre « À compléter » de l'atelier montre tous les autres.
- Le fichier est écrit avec un mot par ligne et dans l'ordre de Tri, pour que l'historique de ses versions reste lisible.

### 6.2 Lecture de la définition

Une fonction unique transforme le texte brut en structure d'affichage. Elle sert à la fiche, à l'aperçu de l'atelier et au quiz.

- Une ligne qui commence par `1.`, `2.`… ouvre un sens. Sans numéro, il n'y a qu'un sens.
- Du texte placé avant le `1.` (« Synon. littér. de déployer. ») forme un chapeau, affiché au-dessus des sens numérotés. Le quiz interroge alors sur le premier sens numéroté.
- Des crochets en tête de sens donnent son indication. Une indication courte est composée en petites capitales ; une indication de plus de 30 caractères (« En parlant des ailes d'un oiseau… ») l'est en italique courant, plus lisible. Les abréviations courantes sont développées à l'affichage (`[Litt.]` devient « Littéraire », `[Fig.]` « Figuré », `[Par ext.]` « Par extension »…) ; une abréviation inconnue est affichée telle quelle. Les crochets au milieu du texte restent dans le texte.
- `EX:`, `SYN:`, `US:`, `ANT:` et `ANTON:` (avec ou sans espace avant les deux-points) ouvrent respectivement un exemple, des synonymes, un usage, des antonymes, jusqu'à la balise suivante ou la fin du sens.
- **Règle de sûreté** : un texte que la fonction ne sait pas découper est affiché entier, comme un seul sens. Aucun caractère n'est jamais perdu.

### 6.3 Typographie à l'affichage

Appliquée à l'affichage seulement, jamais au texte enregistré :

- apostrophes droites remplacées par des apostrophes courbes, `...` par des points de suspension ;
- exemples placés entre guillemets français, avec espaces fines insécables ;
- la ponctuation haute (`;`, `:`, `?`, `!`) est laissée comme Philippe l'a saisie, sans espace ajoutée.

### 6.4 Les sources

Chaque ligne de Source est lue comme `Auteur: Titre (pages)`. Sans deux-points, toute la ligne est un titre sans auteur. Les pages restent dans le texte saisi mais ne sont pas affichées (décidé par Philippe pour la 1.0.1). L'auteur sert au filtre du Recueil.

### 6.5 Ce que chaque appareil garde pour lui

Mots vus, case de mémoire, date de prochaine révision, favoris, réglages. Ces données restent sur l'appareil et ne sont jamais envoyées. Un `id` qui n'existe plus dans la liste est simplement ignoré.

### 6.6 Affichage du genre

Le Genre est enregistré tel que Philippe l'écrit (`subst. masc.`, `verbe trans.`) et développé à l'affichage, sans rien retirer : `adj.` devient « adjectif », `subst. masc.` « nom masculin », `subst. fém. plur.` « nom féminin pluriel », `verbe trans.` « verbe transitif », `verbe pronom.` « verbe pronominal », `loc. adv.` « locution adverbiale », `expr.` « expression », `adj. + subst. masc.` « adjectif et nom masculin ». Un terme inconnu est affiché tel quel. L'atelier montre toujours la forme abrégée.

## 7. Publication en ligne

- Le projet vit dans un dépôt GitHub public, `iago-swi/jolis-mots`.
- Le code est sur la branche `main`. La liste des mots est sur une branche séparée, `donnees`, qui ne contient que `mots.json`.
- **Sous Windows**, l'atelier travaille sur une copie locale de cette branche, rangée dans le dossier de données de l'application (`%APPDATA%\Jolis Mots\donnees`). Il la télécharge lui-même au premier lancement, avec `git`. « Enregistrer » écrit `mots.json` dans cette copie. « Envoyer au téléphone » crée une seule version datée (« Liste du 24 novembre 2026 : 3 mots modifiés, 1 ajouté ») et l'envoie sur GitHub avec le `git` déjà installé et configuré sur la machine. L'application ne manipule aucun mot de passe ni jeton.
- Sans réseau ou sans `git` au premier lancement, les écrans Mot, Quiz et Recueil fonctionnent avec la liste embarquée, et l'atelier dit ce qui lui manque.
- Le **compteur** de modifications pas encore envoyées compare, mot par mot, la copie locale à la dernière liste envoyée : un mot enregistré trois fois compte une fois, un mot remis comme avant ne compte plus. Il est juste après un redémarrage.
- Avant tout envoi, la liste est contrôlée : l'atelier refuse d'envoyer une liste vide, ou des identifiants vides ou en double. Le téléphone refuse lui aussi une telle liste.
- Si la liste en ligne a changé ailleurs : sans modification en attente, l'atelier prend la liste en ligne ; sinon il s'arrête, l'explique, et propose de reprendre la liste en ligne après avoir mis la version locale de côté dans un fichier daté. Il n'écrase jamais la liste en ligne.
- Après un envoi réussi, l'atelier précise que le téléphone verra la liste dans quelques minutes, le temps que GitHub la serve.
- L'atelier est désormais la seule source des mots : `npm run import` refuse de tourner sans l'option `--ecraser`.
- **Sur le téléphone**, l'application affiche d'abord la liste qu'elle a déjà. Si elle a du réseau, elle demande en arrière-plan `https://raw.githubusercontent.com/iago-swi/jolis-mots/donnees/mots.json` et, si la liste a changé, l'adopte à partir du mot suivant. Sans réseau ou en cas d'erreur, rien ne se passe et rien n'est signalé.
- L'application embarque la liste telle qu'elle était au moment de sa fabrication, pour fonctionner dès le premier lancement.
- Si l'envoi échoue (pas de réseau, refus de GitHub), l'atelier le dit en clair et les modifications restent en attente, sans rien perdre.
- La version Windows lit ses mots directement dans la copie locale de l'atelier.

Conséquence acceptée par Philippe : la liste, définitions reprises du CNRTL comprises, est lisible publiquement à cette adresse.

**Décidé par Philippe : les champs Note et Util. font partie de la liste publiée.** Il n'y a donc qu'un seul fichier, `mots.json`, et une seule sauvegarde. L'autre possibilité, écartée, était de tenir ces deux champs dans un second fichier non publié.

## 8. Import initial depuis l'Excel

Un outil à part, lancé une fois (et relançable tant que l'atelier n'a pas pris le relais), lit la feuille « Philippe » et produit `mots.json` et un **rapport d'import** lisible.

- Toute ligne qui porte `###`, dans Genre ou dans Définition, est importée avec « à compléter » coché. Les `###` sont ensuite retirés des deux champs ; le reste du texte est gardé tel quel, notes rapides comprises (`(biere)` reste dans Définition).
- Une ligne sans dièse et sans définition est aussi importée « à compléter ».
- Les 3 mots marqués `###` qui ont déjà une vraie définition restent « à compléter » : Philippe décochera la case dans l'atelier s'il les juge finis.
- Les espaces en trop, insécables comprises, sont retirées en début et en fin de Mot et de Tri.
- Une source `-` devient vide. Les sources sur plusieurs lignes deviennent plusieurs sources.
- L'italique de l'Excel n'est pas repris : il est déduit de la balise `EX:`.
- **Lignes rouges** : ce sont les doublons que Philippe n'a pas départagés. Elles sont toutes importées telles quelles, sans fusion ni suppression, et listées dans le rapport. Il les départagera dans l'atelier, avec le filtre Doublons.
- **Autres doublons** (même Mot, sans tenir compte des majuscules et des espaces, hors lignes rouges) : si une seule ligne a une définition, elle est gardée, les sources sont réunies et les lignes vides sont écartées. Si plusieurs en ont une, toutes sont gardées. Si aucune n'en a, une seule est gardée.
- Le rapport liste les doublons fusionnés, les doublons gardés, les mots « à compléter » qui ont déjà du texte en Définition, et les valeurs de Genre inhabituelles (par exemple `subst. C2223`).

`vocabulaire.xlsx` reste sur la machine de Philippe comme archive et n'entre pas dans le dépôt.

## 9. Allure

**Décidé par Philippe : le design de la maquette, avec quatre palettes au choix dans les réglages.** Trois autres designs (Affiche, Carnet, Frontispice) lui ont été montrés dans `maquette/variantes.html` et écartés.

- Une seule police, **EB Garamond**, embarquée dans l'application (elle ne dépend pas du réseau).
- Petites capitales espacées pour les intitulés, italique pour la nature du mot et les exemples.
- Quatre palettes, qui ne changent que six couleurs :

| Palette | Papier | Encre | Secondaire | Filets | Exemple | Accent |
| --- | --- | --- | --- | --- | --- | --- |
| Papier | `#F3F4EF` | `#1A2230` | `#566070` | `#D5D8D0` | `#3A4352` | `#B8321E` |
| Nuit | `#14181F` | `#ECE9E0` | `#A3A9B3` | `#2F3641` | `#C9CCD2` | `#E8765F` |
| Ivoire | `#F6EFE2` | `#2B2118` | `#6B5B4B` | `#DDD2BF` | `#4A3B2D` | `#8A4B14` |
| Céruléen | `#EEF2F6` | `#14233B` | `#51607A` | `#CFD8E3` | `#33435C` | `#1F5FA8` |

- La palette s'applique à tous les écrans, atelier compris. Tout texte garde un contraste d'au moins 4,5 pour 1 avec son fond.
- Zones tactiles d'au moins 44 px ; texte lisible à bout de bras.
- Mouvements rares et courts ; aucun si le système demande de les réduire.

## 10. Comment c'est construit (choix de Claude)

Même technique que Capitales, version Claude, qui tourne déjà sur le téléphone de Philippe. Voir `..\Capitales\Claude\` et la section 14 de son `PROJECT.md`.

- Une application web en TypeScript et Svelte, fabriquée avec Vite, tests avec Vitest.
- **Android** : Capacitor produit un APK installé à la main (identifiant `ch.noth.jolismots`). Le SDK Android est déjà en place (`C:\Android\Sdk`). Il manque un JDK entre 17 et 24 : installer Temurin 21, avec l'accord de Philippe. Le script `build-apk.mjs` de Capitales sert de modèle.
- **Windows** : Electron, avec un installeur et une version portable. L'atelier n'existe que dans cette version ; il accède aux fichiers et à `git` par le processus principal d'Electron.
- **Signature Android** : à partir de la 1.0.0, l'APK est signé avec une clé propre à Jolis Mots, gardée hors du dépôt ; Philippe en choisit le mot de passe. Voir la section 13.2.
- Sur le téléphone, l'application reste en portrait.
- La lecture des définitions, le choix des mots, le quiz et la mémoire sont du code sans interface, testé à part.

### Versions

Selon les règles habituelles de Philippe : un `VERSIONING.md` et un `CHANGELOG.md` calqués sur ceux de Capitales, un seul produit, des étiquettes `vX.Y.Z`, une publication GitHub par version avec l'APK et l'installeur Windows en pièces jointes, tout passant par des demandes de fusion. La version s'affiche dans les réglages. Un envoi de mots sur la branche `donnees` n'est pas une version.

**Décidé par Philippe : le dépôt GitHub est public et documenté**, avec des captures d'écran et les détails techniques. Le `README.md` présente l'application et ses captures ; un `PROJET.md` décrit la technique (architecture, format des données, fabrication de l'APK et de l'installeur). La documentation du dépôt est en français, avec un court résumé en anglais dans le README (choix de Claude).

### Ordre de construction

Pour avoir vite quelque chose sur le téléphone :

1. Import de l'Excel et lecture des définitions.
2. Écrans Mot et Recueil, avec la liste embarquée ; premier APK à essayer.
3. Quiz et mémoire.
4. Version Windows et atelier.
5. Publication en ligne, versions, première publication 1.0.0.

## 11. Laissé au constructeur

- L'organisation des dossiers et du code.
- Les détails d'interaction non décrits ici (transitions, bouton retour d'Android, mise en page de lecture sur grand écran).
- La table complète des abréviations développées.
- Le libellé des messages, en français, dans le ton sobre de la maquette.
- L'icône de l'application, à proposer à Philippe.
- L'outil utilisé pour l'import (Python avec openpyxl est déjà installé).

## 12. Choix de Claude à vérifier par Philippe

- Seule la feuille « Philippe » est importée.
- Les doublons en rouge sont tous gardés à l'import ; un doublon complet apparaît donc sur le téléphone tant qu'il n'a pas été départagé dans l'atelier.
- L'étoile du téléphone est propre à l'appareil. La colonne Note reste un champ de l'atelier et n'apparaît pas sur le téléphone.
- La colonne Util. n'apparaît que dans l'atelier.
- Après l'import, l'atelier devient la référence et l'Excel une archive.
- Quiz de 5, 10, 15 ou 20 questions (10 par défaut) ; révisions à 1, 3, 7, 16 et 35 jours. Une bonne réponse ne fait monter un mot que s'il est dû ; un mot rencontré seulement au quiz reste à lire sur l'écran Mot ; un mot acquis ne revient plus dans « Les mots que j'ai vus ».
- Un mot dont toute la définition est une liste de synonymes est interrogé par ses synonymes (« Synonymes : as, chef… »).
- Un livre à deux auteurs compte pour chacun dans le filtre par auteur.
- Les progrès ne sont pas partagés entre le téléphone et Windows.
- La ponctuation haute est laissée telle que saisie, sans espace ajoutée.
- Les abréviations entre crochets et celles du Genre sont développées à l'affichage (`subst. masc.` devient « nom masculin »).
- Au premier lancement, la palette est « Comme le système ».
- Une case « À compléter » remplace les dièses. Un mot coché n'apparaît pas sur le téléphone, même avec un début de définition.

## 13. Révision pour la version 1.0.0

Le 24 novembre 2026, après la publication de la version 0.1.0 (l'application Android), Philippe a tranché les points que cette conception laissait ouverts pour la version Windows et l'atelier, et demandé deux changements sur le téléphone. Les sections 2, 5, 6, 7, 10 et 12 sont à jour ; cette section dit ce qui a été décidé et pourquoi.

### 13.1 Décidé par Philippe

- **Quiz au choix.** Le quiz n'est plus proposé d'office après quelques mots. L'onglet Quiz offre « Tous les mots » ou « Les mots que j'ai vus ». Sa raison : quelqu'un qui découvre l'application, lit trois mots et tombe sur un quiz qui ne porte que sur ces trois mots trouve cela bizarre.
- **La séance de 5 mots disparaît**, avec son compteur dans l'en-tête et son réglage.
- **Filtres du Recueil** : plus petits, sur une ligne de son téléphone (Pixel 11 Pro), avec les auteurs principaux : Bouvier, Tesson, Rollin, Méral si la place le permet, et les favoris.
- **Clé de signature** propre à Jolis Mots dès la 1.0.0, en acceptant de désinstaller l'application une fois.
- **Play Store** : plus tard, hors de la 1.0.0 (section 13.5).
- Les quatre propositions des sections 13.2 à 13.4.

### 13.2 Approches : la clé de signature Android

1. **Une clé propre, créée pour la 1.0.0** (retenue). Le fichier de clé vit hors du dépôt ; Philippe choisit son mot de passe et le garde. Passer de la clé de débogage à cette clé oblige à désinstaller l'application une fois, ce qui efface les progrès et les favoris du téléphone, vieux d'un jour. La même clé pourra servir au Play Store.
2. **Garder la clé de débogage.** Rien à désinstaller maintenant, mais le Play Store ne l'accepte pas, elle dépend de cette machine, et la désinstallation aurait lieu plus tard avec des mois de progrès à perdre. Écartée.

### 13.3 Approches : la copie de travail et le compteur

Où l'atelier garde sa copie de la branche `donnees` :

1. **Un clone fait par l'atelier dans le dossier de données de l'application** (retenu). L'application installée ne dépend d'aucun dossier de développement.
2. **Le dossier `donnees/` du projet.** Un seul exemplaire sur la machine, mais l'application dépendrait du dossier de développement. Écarté. Conséquence du choix 1 : ce dossier n'est plus qu'une copie pour fabriquer l'application ; il est mis à jour avant chaque fabrication.

Comment compter les modifications pas encore envoyées :

1. **Comparer la copie locale à la dernière liste envoyée, mot par mot** (retenu). Rien à tenir à jour, le chiffre est toujours juste.
2. **Compter les enregistrements.** Plus simple, mais le chiffre gonfle quand on enregistre plusieurs fois le même mot. Écarté.

### 13.4 Approches : quand l'envoi échoue

1. **Dire ce qui s'est passé, ne rien perdre, ne jamais écraser la liste en ligne** (retenu) : voir la section 7. Si les deux listes ont changé, l'atelier propose de reprendre la liste en ligne après avoir mis la version locale de côté.
2. **Fusionner les deux listes mot par mot.** Confortable avec plusieurs postes, mais Philippe travaille sur une seule machine. Écarté pour cette version.
3. **Imposer la liste locale.** Écarté : un envoi en force peut détruire du travail.

### 13.5 Le Play Store, plus tard

Philippe envisage une publication sur le Play Store, soit gratuite, soit avec une limitation levée pour 1 CHF. Rien n'est construit pour cela dans la 1.0.0. À régler avant ce jour :

- **Les définitions.** Elles sont reprises du TLFi. L'ATILF le diffuse « à des fins de consultation pour l'enseignement et la recherche, à l'exclusion de toute exploitation commerciale » (<https://www.atilf.fr/ressources/tlfi/>, consulté le 24 novembre 2026) ; aucune licence ouverte n'y figure. Une application distribuée au public, à plus forte raison payante, demande l'accord écrit de l'ATILF ou des définitions rédigées par Philippe.
- **Note et Util.** Ces deux champs sont dans la liste publiée (section 7). À revoir si d'autres que Philippe téléchargent l'application.
- **Côté Google** : un compte développeur, un test fermé de 14 jours avec 12 testeurs pour un nouveau compte personnel, un paquet AAB, une politique de confidentialité, une fiche de présentation.

### 13.6 Choix de Claude

- Sur Windows, les écrans Mot, Quiz et Recueil s'affichent dans une colonne de lecture centrée ; l'Atelier, quatrième onglet, prend toute la largeur.
- Dans l'atelier, les espaces en début et en fin de Mot et de Tri sont retirées à l'enregistrement, comme à l'import. Aucun autre champ n'est retouché : la définition est enregistrée telle que saisie.
- Les points laissés par la relecture de la 0.1.0 et repris dans la 1.0.0 : contrôle des identifiants et refus d'une liste vide, essai de bout en bout de l'adoption d'une nouvelle liste, chapeau avant le `1.` (« Éployer », « Musarder »), longues indications en italique, place du curseur à l'ouverture et à la fermeture des volets, portrait imposé, éclair clair au lancement en mode sombre.
- En mode sombre, l'écran de lancement d'Android prend les couleurs de Nuit ; le jour, celles de Papier.
- La clé de signature Android se crée par `npm run cle:android`, qui appelle le `keytool` du JDK : le mot de passe est demandé dans le terminal et n'est écrit nulle part.
- Sous Windows, recharger la fenêtre (Ctrl+R) avec une fiche modifiée demande d'abord, comme la fermer : « Recharger sans enregistrer la fiche ? ».
- Dans le filtre Doublons de l'atelier, une recherche garde les groupes entiers : un groupe est montré dès qu'un de ses mots répond, pour comparer ses mots.
- Phrases de l'atelier pour les cas que la conception ne prévoyait pas : « Le fichier des mots de l'atelier est illisible. Tu peux reprendre la liste en ligne ; ta version sera mise de côté. », « L'atelier n'a pas pu recevoir la liste. », « L'atelier n'a pas pu vérifier la liste en ligne. Tu peux continuer à travailler. », « La fiche n'a pas pu être enregistrée. », « L'envoi a échoué. Tes modifications restent en attente. », « La liste en ligne n'a pas pu être reprise. Rien n'a changé ici. », et après une reprise : « La liste en ligne est reprise. Ta version est gardée ici : », suivi du chemin du fichier.


## 14. Version 1.0.2 : l'historique de la liste

Demandé par Philippe le 25 novembre 2026, après la publication de la 1.0.1, et numéroté 1.0.2 à sa demande.

### 14.1 Décidé par Philippe

- Une page, ouverte depuis les Réglages, montre l'historique de la liste des mots, du plus récent au plus ancien. Chaque entrée dit d'où vient la liste, sa date et son heure, ce qui a changé et le nombre de mots.
- Une entrée se déplie : elle montre les mots ajoutés (marqués « + »), modifiés et supprimés (marqués « − »), par ordre alphabétique. Elle ne montre pas toute la liste.
- L'affichage reste sobre : ce n'est qu'une information.

### 14.2 Choix de Claude

- **Approche.** Le téléphone ne voit pas l'historique de GitHub, seulement la liste du moment. C'est donc l'appareil qui tient son historique : à chaque nouvelle liste (une date `publie` plus récente que la dernière notée), il la compare à la dernière liste notée. Écarté : écrire l'historique dans `mots.json`, ce qui change le format publié pour une simple information.
- **Ce qui compte.** Seuls les mots complets, ceux que le téléphone montre. Ajouté : un mot complet qui ne l'était pas (nouveau, ou « À compléter » décoché). Supprimé : un mot complet qui ne l'est plus (supprimé, ou recoché). Modifié : un mot complet des deux côtés dont le mot, le genre, la définition ou les sources ont changé (la note et l'utilisation, que le téléphone n'affiche pas, ne comptent pas).
- **Signes.** « + » pour un ajout, « ~ » pour une modification, « − » pour une suppression. Les trois signes ont la même couleur, l'encre secondaire (décidé par Philippe : les trois d'une seule couleur, ou chacun la sienne ; les six couleurs des palettes n'ont pas de vert). Un mot supprimé est en encre secondaire. La liste dépliée est petite et serrée (décidé par Philippe : « c'est vraiment juste une information »).
- **Première entrée.** « Début de l'historique », avec le nombre de mots, sans liste à déplier. Une réinstallation remet l'historique à zéro.
- **Sur Windows.** Un enregistrement dans l'atelier ne change pas la date de la liste ; un envoi, si. L'entrée apparaît donc à l'envoi réussi et compare avec la liste envoyée précédente : sur bureau, l'historique note la liste envoyée, jamais la copie de travail.
- Toucher un mot ajouté ou modifié ouvre sa fiche. Une liste qui ne change aucun mot visible ne crée pas d'entrée. L'historique garde les 200 dernières entrées.

## 15. Version 1.0.3 : saisie rapide, vérificateur, orthographe, historique complet sous Windows

Demandé par Philippe le 25 novembre 2026 pour nettoyer et compléter ses mots dans l'atelier ; numéroté 1.0.3 à sa demande. Tout ce qui suit ne concerne que l'atelier sous Windows, sauf l'historique, dont seule la version Windows change.

### 15.1 Décidé par Philippe

- **Saisie rapide, approche C** (les deux) : une barre de boutons au-dessus de la définition, et des abréviations développées par la touche Tab. Écartées : la barre seule (il faut lâcher le clavier), les abréviations seules (rien à voir pour les apprendre).
- **Un vérificateur** de tous les mots complets : cohérence des balises et des indications, fautes, numérotation, genre.
- **L'orthographe en français** pendant la saisie (le correcteur était en anglais).
- **Sous Windows, l'historique de la liste** se lit sur GitHub, depuis le premier import ; le téléphone garde le sien, qui commence à son installation.

Décidé en route :

- **Un point final à chaque sens**, que « Corriger » pose d'un clic (à la fin du texte propre du sens, avant ses balises).
- **Des propositions de correction** chargées depuis un fichier (« Charger des propositions… ») : chacune apparaît dans la fiche de son mot, avec « Corriger » pour l'appliquer et « Non » pour l'écarter.
- **Note et Util. en petit sur la première ligne** de la fiche, après Genre. Dans une fiche étroite, Genre, Note et Util. passent sur une deuxième ligne, pour qu'aucun genre ne soit coupé.
- **Le pied de fiche sur une ligne** : la case « À compléter », le CNRTL en lien, « Supprimer ce mot », puis « Enregistrer ».
- **La zone de définition ne rétrécit pas** : elle garde neuf lignes au moins ; quand la place manque, ce sont les champs qui défilent.

### 15.2 Saisie rapide

- La barre, sobre, sur une ligne : `1.` [Litt.] [Fig.] [Par ext.] [Vieux] [Fam.] `EX:` `SYN:` `US:` et « ⋯ », qui déplie les autres. Un clic insère au curseur ; au survol, chaque bouton montre son abréviation.
- Tab, quand le mot juste avant le curseur est une abréviation connue, le remplace. Sinon, Tab garde son rôle.

| Abréviation | Devient |
| --- | --- |
| `litt`, `fig`, `ext`, `anal`, `meto`, `meta` | `[Litt.] `, `[Fig.] `, `[Par ext.] `, `[Par anal.] `, `[Par méton.] `, `[Par métaph.] ` |
| `vx`, `vi`, `fam`, `pej`, `pop`, `rare` | `[Vieux] `, `[Vieilli] `, `[Fam.] `, `[Péj.] `, `[Pop.] `, `[Rare] ` |
| `ex`, `syn`, `us`, `ant` | `EX: `, `SYN: `, `US: `, `ANTON: ` |
| `n` | un retour à la ligne et le numéro du sens suivant (`2. `) |

- L'insertion passe par l'édition du navigateur : Ctrl+Z l'annule comme une frappe.

### 15.3 Le vérificateur

- Un cinquième filtre de la liste, « À vérifier », avec son nombre : les mots complets qui ont une remarque, et les mots qui ont une proposition de correction.
- Dans la fiche, au-dessus de la définition, les remarques du mot, une ligne chacune :
  - balise mal écrite (`EX :`, `Ex:`, `Syn:`) ;
  - indication entre crochets inconnue : ni dans la table des abréviations développées, ni employée ailleurs dans la liste ;
  - indication hors crochets en tête d'un sens (« Sens figuré », « Fig. », un mot en minuscules suivi d'une majuscule, comme « fauconnerie Oiseau ») ;
  - numérotation qui saute ou ne commence pas à 1 ;
  - crochet, parenthèse ou guillemet non fermé ; `EX:` vide ;
  - genre vide, ou inconnu de la table des genres ;
  - espaces doubles, espace avant un point ou une virgule (les passages cités, trois au plus) ;
  - point final manquant à la fin d'un sens ;
  - mots inconnus du dictionnaire français.
- « Corriger » est proposé pour les écarts mécaniques (balise mal écrite, espaces, point final manquant) : le texte ne change que sur ce clic. « C'est voulu » fait taire cette sorte de remarque pour ce mot, durablement, sur cet ordinateur.

### 15.4 Orthographe

- Le correcteur de la fenêtre travaille en français.
- Le vérificateur demande au même dictionnaire les mots inconnus de chaque définition.

### 15.5 Historique sous Windows

- L'atelier lit l'histoire de la branche `donnees` sur GitHub (dans sa copie locale) : chaque version envoyée y est comparée à la précédente, avec les règles de la section 14. La première version, l'import depuis l'Excel, ouvre l'historique.
- Sans copie locale ou si la lecture échoue, l'écran montre l'historique noté sur l'ordinateur, comme en 1.0.2.

## 16. Version 1.0.4 : l'annonce d'une nouvelle liste

Demandé par Philippe le 25 novembre 2026 : sur le téléphone, une petite annonce dit que la liste a changé, sans avoir à ouvrir l'historique.

### 16.1 Décidé par Philippe

- Sur le téléphone, quand une nouvelle liste ajoute, modifie ou supprime des mots, une petite annonce s'affiche quelques secondes.
- Elle dit, très brièvement, ce que dit l'historique : ajouts, modifications, suppressions.

### 16.2 Choix de Claude

- **Approche.** L'annonce naît là où le téléphone note la liste dans l'historique (section 14) : elle montre l'entrée qui vient d'y être ajoutée, et dit donc toujours la même chose que l'historique. Écarté : comparer les listes une seconde fois pour l'annonce.
- **Quand.** Au moment où la liste est adoptée : à l'ouverture de l'application, ou au mot suivant. Pas d'annonce pour la première liste (« Début de l'historique »), ni pour une liste qui ne change aucun mot visible. Pas d'annonce sous Windows : l'atelier sait ce qu'il vient d'envoyer.
- **Texte.** « Liste mise à jour · +2 · ~1 → 1 139 mots », avec les seules sortes présentes, comme dans l'historique. Les lecteurs d'écran entendent la phrase en toutes lettres.
- **Allure.** Une pastille sobre en haut de l'écran, sous l'en-tête (en bas, elle cacherait « Mot suivant »), en encre secondaire sur le papier, avec un filet. Elle s'efface après six secondes. La toucher ouvre l'historique, avec cette entrée dépliée.

## 17. Version 1.0.5 : vérifier la liste maintenant

Demandé par Philippe le 25 novembre 2026 : dix minutes après un envoi de l'atelier, le téléphone n'avait encore rien reçu.

### 17.1 Constaté

- Le téléphone ne demandait la liste en ligne qu'au démarrage de l'application. Revenir dans l'application, que Android avait seulement mise en pause, ne demandait rien.
- La liste reçue n'est adoptée qu'au mot suivant (section 5.5) ; l'historique et l'annonce attendent avec elle.
- L'adresse de la liste (`raw.githubusercontent.com`) est gardée en cache par GitHub jusqu'à cinq minutes après un envoi.

### 17.2 Décidé par Philippe

- Un bouton « Vérifier maintenant » dans l'historique de la liste.
- Une vérification quand on revient dans l'application, en plus de celle du démarrage.
- L'annonce de la section 16 était trop pâle (encre secondaire sur le papier, à peine visible en Céruléen) : elle prend les couleurs du bouton « Mot suivant », l'encre en fond et le papier pour le texte, dans chaque palette.

### 17.3 Choix de Claude

- **Le bouton** est en haut de l'historique, sur le téléphone seulement (sous Windows, l'atelier reçoit la liste par git). Il demande la liste à l'API de GitHub (`api.github.com`, cache d'une minute, au lieu de cinq), et, si elle ne répond pas, à l'adresse habituelle. La liste trouvée est adoptée tout de suite : c'est une demande expresse. Une ligne sous le bouton dit le résultat : la nouvelle entrée apparaît en tête, dépliée ; sinon « La liste est à jour » ou « Pas de connexion ».
- **Au retour dans l'application**, la liste est demandée à l'adresse habituelle, comme au démarrage, et garde la règle du mot suivant : rien ne change sous les yeux pendant la lecture. L'API de GitHub n'est pas employée là : elle n'accepte que soixante demandes par heure.

## 18. Le résultat de « Vérifier maintenant » (1.0.6)

### 18.1 Décidé par Philippe

- Après « Vérifier maintenant », une nouvelle liste est dite avec le même bilan que l'annonce de l'écran Mot, plutôt que par « Nouvelle liste reçue ».
- Ce résultat a le même aspect que l'annonce, sur tous les écrans.

### 18.2 Choix de Claude

- **Une seule pastille.** L'annonce et le résultat passent par le même composant : leur aspect ne peut pas diverger. Les trois résultats prennent cet aspect : « Liste mise à jour · +2 · ~1 → 1 139 mots », « La liste est à jour », « Pas de connexion. Réessaie plus tard ».
- **Sous le bouton**, et non à côté : le bilan ne tiendrait pas sur la largeur d'un téléphone. Le résultat reste affiché ; il n'a pas de minuterie, comme avant.
- **Pas d'annonce en plus** sur l'écran Mot : la vérification la remplace, comme en 1.0.5.

## 19. Une seule vérification, une seule bulle (1.0.7)

### 19.1 Décidé par Philippe

- La liste en ligne est vérifiée à deux moments seulement : au lancement de l'application et par le bouton « Vérifier maintenant ». La vérification au retour dans l'application (section 17) est supprimée.
- Dans les deux cas, le résultat est dit par la même bulle, par-dessus l'écran, qui disparaît après dix secondes. Elle dit le bilan des mots récupérés, comme l'annonce de la section 16, ou que la liste est à jour.
- Plus rien ne reste affiché sous le bouton de l'historique (section 18).

### 19.2 Choix de Claude, approuvés par Philippe

- **Une seule vérification :** au lancement comme au bouton, l'API de GitHub d'abord, puis l'adresse habituelle (section 17.3). La liste trouvée est adoptée tout de suite ; l'attente du mot suivant disparaît. Le mot affiché reste, sauf s'il n'est plus dans la liste.
- **Une seule bulle,** en haut de l'écran, sur tous les écrans. Trois textes : « Liste mise à jour · +2 · ~1 → 1 139 mots », « La liste est à jour », « Pas de connexion. Réessaie plus tard ». Le dernier seulement après le bouton : au lancement sans réseau, rien n'est dit.
- **La toucher :** quand des mots sont arrivés, elle ouvre l'historique sur l'entrée dépliée (section 16) ; sinon, ou si l'historique est déjà ouvert, elle se ferme.
- **Dans l'historique,** le bouton dit « Vérification… » pendant la demande ; une nouvelle entrée apparaît dépliée en tête.
- **Sous Windows,** rien ne change : l'atelier reçoit la liste par git, sans bulle.

### 19.3 Choix laissés à Claude

- Si le lancement et le bouton se suivent de près, une seule demande part ; chacun dit son résultat.
- Une liste gardée par une version précédente, pas encore adoptée, l'est au lancement et sa bulle n'est pas remplacée par « La liste est à jour ». Au bouton, en revanche, « La liste est à jour » remplace toujours la bulle affichée : on a demandé, on a une réponse.
- Une réponse qui n'est pas une liste, des deux côtés, compte comme une absence de connexion, jamais comme « La liste est à jour ».
