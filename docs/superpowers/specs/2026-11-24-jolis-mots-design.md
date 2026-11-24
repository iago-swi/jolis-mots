# Jolis Mots : conception

Date : 24 novembre 2026. Statut : en attente de validation par Philippe.

Dans ce document, « décidé par Philippe » signale ce qu'il a dit lui-même. Tout le reste est une proposition de Claude, qu'il peut corriger.

## 1. Intention

Philippe est traducteur (français langue maternelle). Il a rassemblé dans un fichier Excel environ 2 500 mots français rares ou beaux, relevés dans des dictionnaires de mots rares et chez des écrivains comme Nicolas Bouvier et Sylvain Tesson.

Il veut une application qui lui fasse **apprendre ces mots dans les moments creux** : il attend le bus, il ouvre Jolis Mots, un mot s'affiche tout de suite, il en lit deux ou trois, puis un quiz l'aide à les retenir. L'interface doit être belle : c'est un objet pour quelqu'un qui aime la langue.

Deux formes, décidées par Philippe :

- **Android**, la plus importante : lire, apprendre, réviser.
- **Windows** : la même chose, plus un **atelier** pour ajouter, modifier et supprimer des mots.

Le nom exact est **Jolis Mots**.

## 2. Buts, non-buts, anti-buts

### Buts

1. À l'ouverture, un mot est à l'écran en moins d'une seconde, sans réseau, sans menu à traverser.
2. Une séance tient dans une attente de bus : deux ou trois mots, puis un quiz court.
3. Le quiz fait revenir les mots jusqu'à ce qu'ils tiennent.
4. La fiche d'un mot est une belle page typographique.
5. L'atelier permet d'avancer vite dans les 1 396 fiches encore sans définition.
6. Une modification faite dans l'atelier arrive sur le téléphone par un seul bouton.

### Non-buts (pas dans cette version)

- Comptes, plusieurs utilisateurs.
- Synchronisation des progrès entre le téléphone et Windows : chaque appareil garde les siens.
- Notifications, widget « mot du jour ».
- Récupération automatique des définitions sur le CNRTL (un bouton ouvre seulement la page du mot).
- iOS, publication sur le Play Store, version jouable dans le navigateur.
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

La fiche montre, de haut en bas : la nature du mot en toutes lettres (section 6.6), le mot en grand, puis chaque sens avec son numéro, son indication (littéraire, figuré…), son texte, ses synonymes et son exemple en italique entre guillemets. En bas, sous le titre « Rencontré chez », la liste des sources : auteur, titre en italique, page.

- Seuls les mots **complets** apparaissent sur les écrans Mot, Quiz et Recueil. Un mot est complet quand sa définition est remplie et qu'il n'est pas marqué « à compléter » (section 6.1).
- **Mot suivant** passe au mot suivant ; un glissement vers la gauche fait de même, vers la droite revient au précédent de la séance.
- Une **séance** compte 3 mots (réglable de 2 à 5). Après le dernier, le bouton principal devient **Passer au quiz** ; un bouton secondaire « Encore un mot » permet de continuer à lire.
- Choix du mot : au hasard parmi les mots complets jamais vus. Quand tous ont été vus, ceux vus il y a le plus longtemps.
- L'**étoile** marque un favori. Les favoris sont gardés sur l'appareil.
- Une fiche plus longue que l'écran défile ; les boutons restent visibles en bas.

### 5.2 Écran « Quiz »

Le quiz porte d'abord sur les mots de la séance en cours, puis sur les mots vus auparavant qui sont dus pour une révision. Dix questions au plus par quiz.

Deux formes de question, quatre réponses au choix :

- une définition est donnée, il faut trouver le mot ;
- un mot est donné, il faut trouver sa définition.

Règles :

- La définition montrée est le texte du premier sens, sans exemple. Si le mot lui-même y figure, il est remplacé par un tiret long.
- Les mauvaises réponses sont tirées parmi les mots complets de même nature grammaticale, et jamais parmi les synonymes déclarés de la bonne réponse. « Même nature » veut dire le même Genre exact ; s'il n'y en a pas assez, le même premier terme du Genre (`adj.`, `subst.`, `verbe`…) ; à défaut, n'importe quel mot complet.
- Après la réponse, la bonne est mise en évidence, la mauvaise barrée. La différence ne repose pas sur la seule couleur.
- **Mémoire** : cinq cases, à la manière des boîtes de Leitner. Un mot vu entre en case 1. Une bonne réponse le fait monter d'une case, une mauvaise le renvoie en case 1. Il redevient dû après 1, 3, 7, 16 puis 35 jours selon sa case. Une bonne réponse en case 5 le déclare acquis : il ne revient plus dans les quiz.
- Ouvert sans séance en cours et sans mot dû, l'écran dit qu'il n'y a rien à réviser et propose de lire de nouveaux mots.

Le ton reste sobre : « Juste. » ou « C'était *baguenauder*. », sans score ni récompense.

### 5.3 Écran « Recueil »

La liste alphabétique des mots complets, classée selon la colonne Tri, avec une lettrine par lettre. Chaque ligne montre le mot, sa nature et le début de sa définition.

- **Recherche** sur Mot et Tri, sans tenir compte des accents ni des majuscules.
- **Filtres** : Tous, Favoris, et par auteur. Bouvier et Tesson sont proposés directement ; un choix « Autres auteurs » ouvre la liste complète, classée par nombre de mots.
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

**En haut, « Envoyer au téléphone »**, avec le nombre de modifications pas encore envoyées. Voir la section 7.

### 5.5 Réglages

Un écran discret, accessible depuis l'en-tête : nombre de mots par séance, palette (Papier, Nuit, Ivoire, Céruléen, ou « Comme le système » : Papier le jour, Nuit quand l'appareil est en mode sombre), version de l'application, date de la dernière liste reçue, et un bouton pour effacer les progrès de l'appareil (avec confirmation).

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
- Des crochets en tête de sens donnent son indication. Les abréviations courantes sont développées à l'affichage (`[Litt.]` devient « Littéraire », `[Fig.]` « Figuré », `[Par ext.]` « Par extension »…) ; une abréviation inconnue est affichée telle quelle. Les crochets au milieu du texte restent dans le texte.
- `EX:`, `SYN:`, `US:`, `ANT:` et `ANTON:` (avec ou sans espace avant les deux-points) ouvrent respectivement un exemple, des synonymes, un usage, des antonymes, jusqu'à la balise suivante ou la fin du sens.
- **Règle de sûreté** : un texte que la fonction ne sait pas découper est affiché entier, comme un seul sens. Aucun caractère n'est jamais perdu.

### 6.3 Typographie à l'affichage

Appliquée à l'affichage seulement, jamais au texte enregistré :

- apostrophes droites remplacées par des apostrophes courbes, `...` par des points de suspension ;
- exemples placés entre guillemets français, avec espaces fines insécables ;
- la ponctuation haute (`;`, `:`, `?`, `!`) est laissée comme Philippe l'a saisie, sans espace ajoutée.

### 6.4 Les sources

Chaque ligne de Source est lue comme `Auteur: Titre (pages)`. Sans deux-points, toute la ligne est un titre sans auteur. Les pages sont affichées « p. 334 ». L'auteur sert au filtre du Recueil.

### 6.5 Ce que chaque appareil garde pour lui

Mots vus, case de mémoire, date de prochaine révision, favoris, réglages. Ces données restent sur l'appareil et ne sont jamais envoyées. Un `id` qui n'existe plus dans la liste est simplement ignoré.

### 6.6 Affichage du genre

Le Genre est enregistré tel que Philippe l'écrit (`subst. masc.`, `verbe trans.`) et développé à l'affichage, sans rien retirer : `adj.` devient « adjectif », `subst. masc.` « nom masculin », `subst. fém. plur.` « nom féminin pluriel », `verbe trans.` « verbe transitif », `verbe pronom.` « verbe pronominal », `loc. adv.` « locution adverbiale », `expr.` « expression », `adj. + subst. masc.` « adjectif et nom masculin ». Un terme inconnu est affiché tel quel. L'atelier montre toujours la forme abrégée.

## 7. Publication en ligne

- Le projet vit dans un dépôt GitHub public, `iago-swi/jolis-mots`.
- Le code est sur la branche `main`. La liste des mots est sur une branche séparée, `donnees`, qui ne contient que `mots.json`.
- **Sous Windows**, l'atelier travaille sur une copie locale de cette branche, rangée dans le dossier de données de l'application. « Enregistrer » écrit dans cette copie. « Envoyer au téléphone » crée une version datée et l'envoie sur GitHub avec le `git` déjà installé et configuré sur la machine. L'application ne manipule aucun mot de passe ni jeton.
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
- Séance de 3 mots ; quiz de 10 questions au plus ; révisions à 1, 3, 7, 16 et 35 jours.
- Les progrès ne sont pas partagés entre le téléphone et Windows.
- La ponctuation haute est laissée telle que saisie, sans espace ajoutée.
- Les abréviations entre crochets et celles du Genre sont développées à l'affichage (`subst. masc.` devient « nom masculin »).
- Au premier lancement, la palette est « Comme le système ».
- Une case « À compléter » remplace les dièses. Un mot coché n'apparaît pas sur le téléphone, même avec un début de définition.