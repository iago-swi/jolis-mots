# Jolis Mots : notes techniques

Ce document décrit le dépôt tel qu'il est à la version 1.0.3. La [conception](docs/superpowers/specs/2026-11-24-jolis-mots-design.md) dit pourquoi ; ici, on dit comment. Pour utiliser l'application, voir le [README](README.md).

## Vue d'ensemble

Tout est en TypeScript, dans un dépôt `npm` à plusieurs paquets (workspaces) :

| Paquet | Dossier | Rôle |
| --- | --- | --- |
| `@jolis-mots/core` | `packages/core` | Toute la logique, sans interface : lecture des définitions, mémoire, quiz, recherche, format du fichier, import, atelier et envoi. Testée avec Vitest. |
| `@jolis-mots/web` | `apps/web` | L'application : Svelte 5 et Vite. C'est elle qui est affichée, sur Android, sous Windows et dans un navigateur. |
| `@jolis-mots/android` | `apps/android` | L'enveloppe Android : Capacitor emballe la construction de `apps/web` dans un APK. |
| `@jolis-mots/desktop` | `apps/desktop` | L'enveloppe Windows : Electron montre la construction de `apps/web` et donne à l'atelier l'accès à la copie locale de la liste, par `git`. |

À côté : `tools/import` (import depuis l'Excel), `scripts/captures.mjs` (captures d'écran du README), `scripts/maj-donnees.mjs` (mise à jour de `donnees/` avant une fabrication), `version.ts` (numéro de version, lu par Vite).

Le cœur est livré en TypeScript (`"exports": "./src/index.ts"`) : Vite le transforme comme le code de l'application, il n'y a pas d'étape de compilation séparée. Pour Electron, esbuild l'assemble avec le processus principal (voir plus bas).

## Le cœur (`packages/core/src`)

| Fichier | Contenu |
| --- | --- |
| `types.ts` | `Mot`, `FichierMots`, `estComplet`. |
| `definition.ts` | `lireDefinition`, `developperIndication`, `indicationEstLongue`, `ABREVIATIONS_INDICATION`, `DEBUT_DE_SENS`. |
| `genre.ts` | `developperGenre` (« subst. masc. » devient « nom masculin »), `premierTerme`, `genreEstConnu`. |
| `sources.ts` | `lireSource`, `auteursDe`, `nomCourt`, `auteursParNombre`. |
| `recherche.ts` | `normaliser`, `ordonner`, `lettrine`, `filtrer`. |
| `typographie.ts` | `embellir` (apostrophe courbe, points de suspension), `entreGuillemets`, `tailleDuMot`. |
| `fichier.ts` | `ecrireFichier`, `validerFichier`, `comparerMots`, `creerId`, `creerIdUnique`. |
| `hasard.ts` | `melanger` (Fisher–Yates, avec un hasard injecté). |
| `memoire.ts` | `marquerVu`, `marquerMontre`, `repondre`, `motsDus`, `motsARevoir`, `validerProgres`, `INTERVALLES`. |
| `selection.ts` | `prochainMot`. |
| `quiz.ts` | `composerQuiz`, `compterPortees`, `definitionPourQuiz`, `QUESTIONS_POSSIBLES`. |
| `miseAJour.ts` | `ADRESSE_LISTE`, `choisirListe`. |
| `saisie.ts` | La saisie rapide de l'atelier (conception, section 15.2) : `ABREVIATIONS_SAISIE`, `BOUTONS_SAISIE`, `developper` (Tab), `insertionPour` (un bouton), `numeroSuivant`. |
| `verification.ts` | Le vérificateur (conception, section 15.3) : `verifierMot`, `indicationsConnues`, `corrigerBalises`, `corrigerEspaces`, les codes de remarque (`CodeRemarque`). |
| `orthographe.ts` | Les mots d'une définition à soumettre au dictionnaire et ceux qu'il ne connaît pas (conception, section 15.4) : `motsAVerifier`, `motsInconnus`, `remarqueOrthographe`. Le dictionnaire est passé en fonction. |
| `propositions.ts` | Les propositions de correction lues dans un fichier : `lirePropositions`, `lireProposition`, `cleProposition`, `appliquable`, `appliquer`. |
| `historique.ts` | `noterListe`, `historiqueDeListes`, `referenceDe`, `validerHistorique`, `validerReference`, `HISTORIQUE_MAX` : l'historique de la liste (conception, sections 14 et 15.5). |
| `stockage.ts` | `lireJson`. |
| `import.ts` | `importer`, `rapportEnMarkdown`. |
| `atelier.ts` | La liste et la fiche de l'atelier : `proposerTri`, `groupesDeDoublons`, `compterFiltres`, `listerAtelier`, `genresUtilises`, `homonymes`, `adresseCnrtl`, `nouvelleFiche`, `nettoyerFiche`, `poserFiche`, `retirerFiche`, `lignesDeSources`. |
| `envoi.ts` | L'envoi : `compterModifications`, `decrireModifications`, `messageDEnvoi`, `validerPourEnvoi`, `dater`. |
| `pont.ts` | Les types du pont entre l'application et Electron : `PontBureau` (dont `motsInconnus` et `historique`, depuis la 1.0.3), `EtatDepot`, `RaisonDepot`. |

Chaque fichier a son `.test.ts` à côté, sauf `hasard.ts` et `pont.ts`.

Un mot est **complet** quand sa définition n'est pas vide et que `aCompleter` est faux. Seuls les mots complets apparaissent dans les écrans Mot, Quiz et Recueil ; l'atelier les montre tous.

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
- `id` : six caractères parmi `a-z0-9`, tirés par `creerId`. Un mot garde son identifiant, car les progrès sur l'appareil s'y rattachent. L'atelier tire un identifiant que ne porte aucun mot, ni dans sa liste, ni dans la dernière liste envoyée (`creerIdUnique`).
- `mot` est le mot tel qu'affiché (« S'abolir ») ; `tri` sert au classement et à la recherche (« abolir »).
- `genre` : nature grammaticale abrégée (`adj.`, `subst. masc.`, `verbe trans.`…), développée à l'affichage.
- `sources` : une ligne par livre, de la forme `Auteur: Titre (pages)`. Les pages sont facultatives ; l'application ne les affiche pas (décidé par Philippe pour la 1.0.1) : l'auteur et l'ouvrage suffisent. Un livre à deux auteurs s'écrit `A & B: Titre` et compte pour chacun dans le filtre par auteur.
- `note` et `util` viennent de l'Excel ; seul l'atelier les montre (« Note », « Utilisé dans mes livres »).
- `validerFichier` rend le fichier s'il a la bonne forme, sinon `null`. Un identifiant vide, ou porté par deux mots, rend le fichier invalide.

Le texte saisi (`mot`, `definition`, `sources`…) n'est jamais modifié par l'affichage : l'embellissement typographique se fait à l'écran, sur une copie.

### Les conventions de définition et leur lecture

La définition est un texte brut. `lireDefinition` le découpe en sens, sans rien écarter : un texte hors conventions reste entier dans le champ `texte` d'un seul sens.

- **Sens numérotés** : dès qu'une ligne commence par `1.`, chaque ligne suivante commençant par `2.`, `3.`… ouvre un sens, et les lignes qui suivent lui appartiennent. Le texte placé avant le `1.` forme le **chapeau**, un premier sens sans numéro, affiché au-dessus des sens numérotés (« Éployer », « Musarder »). Exception : une seule ligne faite d'une indication entre crochets (« [Argot] ») devient l'indication du premier sens, ou, s'il a déjà la sienne, reste en tête de son texte. Sans ligne `1.`, tout le texte forme un seul sens, sans numéro.
- **Indication** : un sens peut commencer par une indication entre crochets, `[Litt.]` ou `[Par ext.]`. Les crochets sont retirés, et `developperIndication` développe les abréviations connues (`Litt.` devient « Littéraire », `fig.` « Figuré », `par ext.` « Par extension », `fam.`, `péj.`, `pop.`, `vulg.`, `argot.`, `poét.`, `iron.`, `par anal.`, `par méton.`, `par métaph.`). Un terme inconnu reste tel quel. Une indication de plus de 30 caractères (`indicationEstLongue`) est composée en italique courant au lieu des petites capitales.
- **Balises** : `EX:` (exemple), `SYN:` (synonymes, séparés par des virgules), `US:` (usage), `ANTON:` ou `ANT:` (antonymes). La balise est reconnue seulement au début d'un mot (pas dans « SEX: »). Plusieurs exemples sont possibles dans un même sens.

L'import vérifie, sur les définitions réelles, que la lecture ne perd aucun mot (voir plus bas).

### La taille du mot

Sur la fiche, le mot a une seule grande taille, 54 px ; une expression passe à la ligne entre ses mots, à la même taille. Seul un mot dont un morceau d'un seul tenant (sans espace ni trait d'union) dépasse 12 lettres prend la seconde taille, 40 px (`tailleDuMot`). Deux tailles, jamais un dégradé.

## L'application web (`apps/web/src`)

### Écrans et composants

- `App.svelte` : en-tête, écran courant, barre d'onglets. L'écran se choisit par l'adresse (`#mot`, `#quiz`, `#recueil`, `#reglages`, `#historique`, et `#atelier` sur bureau seulement) ; sans adresse, c'est Mot. Sur bureau, les écrans de lecture tiennent dans une colonne centrée de 560 px ; l'Atelier prend toute la largeur.
- `ecrans/Mot.svelte` : la fiche du mot courant (`composants/Fiche.svelte`), un glissement horizontal de plus de 60 px, au doigt ou au stylet, pour changer de mot (à la souris, glisser sélectionne le texte), l'étoile des favoris, « Mot suivant ».
- `ecrans/Quiz.svelte` : le choix « Tous les mots » ou « Les mots que j'ai vus », puis les questions ; voir plus bas.
- `ecrans/Recueil.svelte` : la liste alphabétique avec lettrines, la recherche, les filtres sur une ligne (Bouvier, Tesson, Rollin, l'étoile des favoris, et « Autres », qui ouvre un volet avec les autres auteurs et le nombre de mots de chacun), la fiche ouverte dans un volet. Un seul filtre est allumé à la fois ; toucher le filtre allumé l'éteint. Quand un autre auteur est choisi, le bouton « Autres » prend son nom ; un nom trop long pour la ligne finit par « … », le nom entier restant dans `aria-label` et `title`.
- `ecrans/Historique.svelte` : l'historique de la liste, de la plus récente à la plus ancienne ; une entrée se déplie sur ses mots (« + » ajouté, « ~ » modifié, « − » supprimé, par ordre alphabétique) ; un mot ajouté ou modifié encore dans la liste ouvre sa fiche dans un volet (`etat.ficheOuverte`, que le bouton retour d'Android ferme d'abord). On y vient des Réglages ; le bouton retour y ramène. Sur le téléphone, l'état note chaque liste adoptée ; sur bureau, c'est l'atelier qui note chaque liste envoyée ou reçue (`envoyee`), jamais la copie de travail : un envoi qui échoue ne laisse pas d'entrée. Depuis la 1.0.3, sur bureau, l'écran demande à l'ouverture l'historique tiré de la copie locale (`atelier.historiqueDuDepot`, voir plus bas) et le montre à la place de celui noté sur l'ordinateur ; en l'attendant, ou s'il manque (pas de copie, lecture échouée, aucune liste), il montre celui de l'ordinateur.
- `ecrans/Reglages.svelte` : questions par quiz, palette, version, date et heure de la liste (« 25 novembre 2026 à 03:44 », heure de l'appareil), la ligne « Historique de la liste », « Effacer mes progrès » ; ce lien reste visible au-dessus de sa confirmation.
- `ecrans/Atelier.svelte` : l'atelier, sur bureau seulement ; voir plus bas.
- `composants/Entete.svelte`, `composants/Onglets.svelte` : l'en-tête (la marque et le bouton des réglages) et les onglets, trois sur le téléphone, quatre sur bureau.
- `volet.ts` : l'action Svelte des volets et des confirmations. À l'ouverture, le curseur va sur l'élément marqué `data-depart`, sinon sur le volet (qui reçoit toujours `tabindex="-1"`) ; Échap ferme, où que soit le curseur ; à la fermeture, le curseur revient à l'élément qui l'avait.

L'état de l'application est dans `etat.svelte.ts` (une classe avec les runes de Svelte 5), celui de l'atelier dans `atelier.svelte.ts`. Les écrans n'ont pas d'état partagé ailleurs.

Sur la fiche, les retours à la ligne saisis dans le texte d'un sens, un exemple ou un usage restent visibles (`white-space: pre-line`).

Une seule police, EB Garamond, embarquée par `@fontsource/eb-garamond` ; aucune ressource n'est chargée d'un CDN. Les couleurs sont six variables CSS (`--papier`, `--encre`, `--second`, `--filet`, `--exemple`, `--accent`), posées selon la palette par l'attribut `data-palette` de la page. `index.html` porte `data-palette="systeme"` avant le premier affichage, et `main.ts` pose la palette choisie avant de monter l'application. Aucun composant n'écrit de couleur en dur. Les cibles tactiles font au moins 44 px. Seule exception, voulue par Philippe : la liste dépliée de l'historique, petite et serrée (« c'est vraiment juste une information »).

### Palettes et réglages

Cinq choix : `systeme` (Papier le jour, Nuit quand l'appareil est en mode sombre), `papier`, `nuit`, `ivoire`, `ceruleen`. Le choix `systeme` est celui de départ.

Les réglages sont deux valeurs : `questionsParQuiz` (5, 10, 15 ou 20, 10 par défaut ; une valeur qui n'est pas un nombre est ramenée à 10, un nombre à la plus petite taille permise qui le contient, ou à 20 au-delà) et `palette`. Les réglages gardés par la 0.1.0 (`motsParSeance`) n'ont pas de nombre de questions : ils prennent 10.

### Adresses de développement

`etat.demarrer` lit l'adresse au premier affichage :

- `?mot=ceruleen` impose le premier mot (comparé au mot entier, puis au tri, sans accents ni majuscules) ;
- `?palette=nuit` impose la palette, sans l'enregistrer ;
- `?quiz=tous` ou `?quiz=vus` ouvre le quiz sans passer par le choix ;
- `#quiz`, `#recueil`, `#reglages`, `#historique` ouvrent l'écran voulu.

`pont.ts` lit en plus `?pont=demo` : dans un navigateur, l'application se comporte comme sur bureau, avec le pont de démonstration de `pont-demo.ts`, tout en mémoire. Il part de la liste embarquée, à la fois liste locale et liste envoyée, et n'écrit rien nulle part. `#atelier` ouvre alors l'atelier. D'autres paramètres simulent les pannes :

- `&envoi=sans-reseau`, `&envoi=refus` ou `&envoi=divergence` fait échouer l'envoi ainsi ;
- `&copie=aucune` part sans copie : la première synchronisation échoue faute de réseau, la suivante la reçoit ;
- `&copie=illisible` part d'une copie dont le fichier des mots ne se lit pas ;
- `&detail=long` donne aux pannes un message de git de sept lignes ;
- `&reprise=echec` fait échouer la reprise de la liste en ligne ;
- `&sync=sans-reseau` fait échouer toute synchronisation faute de réseau, la copie étant là : l'atelier travaille alors sans rien dire ;
- `&historique=depot` donne un historique tiré du dépôt : deux versions, la liste de départ sans ses deux derniers mots, puis entière (sans ce paramètre, le pont n'en a pas, et l'écran montre l'historique de l'appareil).

Le dictionnaire du pont de démonstration connaît tous les mots, sauf `fautte`, `xyzzyq`, `bouffonerie` et `vilbrequin`.

C'est ce qu'utilise `scripts/captures.mjs`.

### Ce que l'appareil garde

Dans `localStorage`, six clés (voir `stockage.ts`) : `jolismots.progres.v1`, `jolismots.favoris.v1`, `jolismots.reglages.v1`, `jolismots.historique.v1` (l'historique de la liste, 200 entrées au plus), `jolismots.reference.v1` (la dernière liste notée, réduite à une empreinte par mot complet), `jolismots.liste.v1` (la dernière liste téléchargée, sur le téléphone). L'atelier en ajoute deux, sur bureau (`atelier.svelte.ts`) : `jolismots.verification.ignorees.v1` (les remarques tues par « C'est voulu », une liste de `id:code`, et `id:orthographe:mot` pour un mot inconnu) et `jolismots.propositions.v1` (les propositions de correction chargées, chacune avec son sort : `attente`, `appliquee` ou `refusee`). Une valeur absente, illisible ou d'une autre forme est remplacée par la valeur par défaut ; dans les progrès, `validerProgres` garde les entrées bien formées et écarte les autres. Un stockage plein ou refusé est ignoré.

Les mots lus depuis l'ouverture (`etat.lus`) et la position dans cette suite vivent en mémoire seulement : ils repartent à zéro à chaque lancement. Il n'y a pas de séance.

### Mémoire et quiz

**Mémoire** (`memoire.ts`). Chaque mot vu a un état : date de dernière vue sur l'écran Mot (`vu`, vide pour un mot rencontré seulement au quiz), case (1 à 5), échéance (`du`), et « acquis ». Un mot est **dû** quand son échéance est passée.

- Un mot montré sur l'écran Mot entre en case 1, dû un jour plus tard (`marquerVu`). S'il est déjà connu, seule sa date de vue change (`marquerMontre`).
- Les délais par case sont 1, 3, 7, 16 et 35 jours (`INTERVALLES`).
- Une bonne réponse sur un mot dû le fait monter d'une case et fixe la nouvelle échéance. En case 5, elle le rend acquis : il ne revient plus.
- Une bonne réponse sur un mot pas encore dû, ou déjà acquis, ne change rien.
- Une mauvaise réponse ramène le mot en case 1, dû un jour plus tard, et lui retire « acquis ».
- Un mot inconnu, rencontré au quiz, entre en case 1, dû un jour plus tard, quelle que soit la réponse, avec une date de vue vide : il reste à lire sur l'écran Mot.
- `motsDus` rend les mots non acquis dont l'échéance est passée, du plus ancien au plus récent ; `motsARevoir` rend ces mots-là, puis les autres mots non acquis, mélangés.

**Choix du mot suivant** (`selection.ts`, `etat.tirer`). Au hasard parmi les mots complets jamais montrés sur l'écran Mot (absents des progrès, ou de date de vue vide) et pas encore lus depuis l'ouverture ; sinon le mot vu le plus anciennement hors de ceux-là. Quand tous les mots complets ont été lus depuis l'ouverture, le tirage recommence parmi tous, sauf le dernier montré : la lecture n'a pas de fin. « Mot suivant » avance d'abord dans les mots déjà lus si l'on est revenu en arrière.

**Quiz** (`quiz.ts`, `Quiz.svelte`). L'écran s'ouvre sur le choix « Sur quels mots ? ». `compterPortees` donne le nombre de mots de chaque choix. Comme l'application s'ouvre toujours sur un mot, « Les mots que j'ai vus » en compte au moins un dès le premier lancement ; le bouton n'est grisé, avec la phrase « Lis d'abord quelques mots : ils viendront ici. », que si aucun mot vu ne peut être interrogé.

- **Tous les mots** (`tous`) : les mots interrogeables, mélangés.
- **Les mots que j'ai vus** (`vus`) : les mots de `motsARevoir` qui sont interrogeables, les dus d'abord.
- Un mot est interrogeable quand il est complet et que son texte au quiz n'est pas vide. `composerQuiz` prend les premiers de la liste choisie, jusqu'au nombre de questions des réglages, en sautant ceux pour lesquels aucune mauvaise réponse n'existe. Le quiz est composé une seule fois, au moment du choix, pour que répondre ne le recompose pas.
- Les formes alternent, en commençant par « quel mot correspond à cette définition ? » puis « que veut dire ce mot ? ». Chaque question a quatre choix : la bonne réponse et trois mauvaises, tirées de préférence parmi les mots de même genre, sinon de même premier terme de genre, sinon de n'importe quel mot interrogeable. Ne sont jamais proposés comme mauvaises réponses, puisqu'ils seraient justes eux aussi : les synonymes du bon mot, un mot de même `mot` (sans majuscules ni accents) et un mot de même texte posé au quiz. Deux choix ne montrent jamais le même texte.
- Le texte posé est le premier texte non vide d'un sens numéroté (le chapeau est sauté), sinon de la définition, avec le mot (et son tri) remplacé par « — ». Quand toute la définition est une liste de synonymes, le mot est interrogé par ses synonymes (« Synonymes : … »). Sans texte ni synonymes, le mot n'est pas interrogé.
- Une réponse enregistre le résultat dans la mémoire. L'écran dit « Juste. » ou donne la bonne réponse, sans score ni série. À la fin : « C'est tout pour cette fois », le nombre de mots revus, puis « Encore un quiz » (retour au choix) ou « Lire des mots » (retour à l'écran Mot). Quitter l'écran abandonne le quiz ; les réponses données restent enregistrées.

### Mise à jour de la liste en ligne

La liste des mots est publiée sur la branche `donnees` du dépôt, fichier `mots.json`. Cette branche ne contient que ce fichier et n'est jamais fusionnée dans `main`.

- Une copie de la liste est **embarquée** dans l'application à la fabrication (`liste-embarquee.ts` importe `donnees/mots.json` ; elle pèse plus de 700 ko). L'application montre donc ses mots sans réseau.
- Sur le téléphone, au démarrage, `miseAJour.ts` demande `https://raw.githubusercontent.com/iago-swi/jolis-mots/donnees/mots.json` (sans cache, abandon au bout de 8 secondes). Sans réseau, sur une erreur ou une réponse inutilisable, il ne fait rien et ne dit rien.
- `choisirListe` ne retient la liste reçue que si elle a la bonne forme, au moins un mot, une date `publie` lisible et plus récente que celle en place. Elle est alors gardée sur l'appareil (`jolismots.liste.v1`) et adoptée au prochain mot tiré, jamais au milieu d'un mot affiché ; tout de suite si la liste en place n'a aucun mot complet.
- Au lancement suivant, la liste gardée est préférée à l'embarquée si elle est valide et plus récente.
- Sur bureau, l'application ne demande pas cette adresse : c'est l'atelier qui reçoit la liste en ligne, par `git` (voir plus bas).

Quand une liste est adoptée (`etat.remplacerListe`), les mots qui ne sont plus complets quittent les mots lus, le mot affiché reste s'il le peut, et la fiche ouverte dans le Recueil se ferme si son mot n'est plus complet.

### L'atelier (`atelier.svelte.ts`, `ecrans/Atelier.svelte`)

L'atelier n'existe que lorsqu'un pont existe (`pont.ts`) : celui d'Electron, `window.jolisMots`, ou celui de démonstration. Sur le téléphone, `atelier` vaut `null`, l'onglet n'apparaît pas et `#atelier` mène à l'écran Mot.

Au lancement sur bureau, `main.ts` attend que l'atelier ait ouvert la copie locale (trois secondes au plus) avant de tirer le premier mot ; au-delà, la lecture part sur la liste embarquée. La liste de travail de l'atelier est `etat.liste`, celle que lisent aussi les écrans de lecture : un mot enregistré y apparaît aussitôt.

La classe `Atelier` tient :

- l'état de la copie (`depot`, un `EtatDepot` rendu par le pont) : le texte de la liste locale et celui de la dernière liste envoyée ou reçue ;
- le compteur de modifications (`compterModifications`), qui compare mot par mot, par identifiant, la liste envoyée à la liste de travail : un mot enregistré trois fois compte une fois, un mot remis comme avant ne compte plus ;
- la fiche en cours (`brouillon`) et le mot tel qu'il est enregistré (`origine`) ; `modifiee` est vrai quand ils diffèrent, ou pour un mot nouveau qui a du texte ;
- la question en attente (`demande`) : quitter une fiche modifiée, supprimer un mot, reprendre la liste en ligne ;
- l'avis affiché, et `divergence`, vrai tant qu'une liste en ligne changée ailleurs n'est pas réglée.

Les opérations passent une à une, dans l'ordre où elles sont demandées. Au démarrage, l'atelier ouvre la copie (`ouvrir`, sans réseau), puis va voir la liste en ligne (`synchroniser`) sans attendre.

**Enregistrer** écrit toute la liste dans la copie locale (`ecrireFichier`). Seuls `mot` et `tri` perdent leurs espaces en début et en fin, insécables comprises (`nettoyerFiche`) ; les autres champs sont enregistrés tels que saisis. Un tri vide reçoit la proposition tirée du mot. Le tri suit le mot (`proposerTri` : avant la première virgule, sans parenthèse finale, en minuscules, sans article ni « se ») tant qu'il n'a pas été modifié à la main.

**Envoyer** contrôle la liste (`validerPourEnvoi` : ni liste vide, ni identifiant vide ou en double, ni mot sans nom), la date (`dater`), compose le message (`messageDEnvoi`, « Liste du 24 novembre 2026 : 3 mots modifiés, 1 ajouté ») et la passe au pont.

Les phrases de l'atelier sont en tête de `atelier.svelte.ts`. Un envoi réussi dit « Liste envoyée. Le téléphone la verra dans quelques minutes. » ; chaque panne a sa phrase (pas de réseau, refus de GitHub, liste en ligne changée ailleurs, `git` introuvable, copie illisible, reprise échouée…). Le message de `git`, en anglais, est montré tel quel en dessous, et seulement sous un avis d'alerte (`detail`) : une panne que l'atelier tait, comme l'absence de réseau avec une copie, ne laisse pas de ligne orpheline. Après une reprise, le chemin du fichier mis de côté est montré tel quel ; de même quand la synchronisation a mis de côté une copie cassée qui tenait un `mots.json` (« L'ancienne copie de l'atelier a été mise de côté ici : »). Sans la dernière liste envoyée (`git` introuvable, branche en ligne absente de la copie), le compteur ne montre rien, « Envoyer au téléphone » reste inactif, et un avis le dit.

Pendant qu'un enregistrement attend son tour (derrière une synchronisation lente) ou tourne, « Enregistrer » devient « Enregistrement… », inactif ; la fiche reste modifiable. Quand une synchronisation ou une reprise remplace la liste, une fiche ouverte non modifiée prend le mot de la nouvelle liste (ou se ferme s'il n'y est plus) ; une fiche modifiée reste un brouillon, comparé au mot de la nouvelle liste.

**Saisie rapide** (`saisie.ts`, conception, section 15.2). La barre montre `BOUTONS_SAISIE` : les principaux, puis ceux que « ⋯ » déplie. Un bouton ne prend pas le curseur (`mousedown` empêché) ; il insère `insertionPour(abreviation, texte avant le curseur)`. Tab, sans modificateur et sans sélection, demande `developper(texte avant le curseur)` : si le mot collé au curseur (après une espace, un retour à la ligne ou le début du texte) est une clé d'`ABREVIATIONS_SAISIE`, majuscules ignorées, ou `n`, il est remplacé ; sinon Tab garde son rôle. `n` (et le bouton `1.`) donne un retour à la ligne, sauf en début de ligne, et `numeroSuivant` : le plus grand numéro en tête de ligne, plus un. Toute insertion passe par `document.execCommand('insertText')` : Ctrl+Z l'annule comme une frappe, et l'événement `input` passe le texte au brouillon.

**Vérificateur** (`verification.ts`, conception, section 15.3). `verifierMot(mot, connues)` ne juge qu'un mot complet ; ses codes : `balise`, `indication-inconnue` (un terme entre crochets qui ressemble à une indication connue sans en être une ; `indicationsConnues` réunit la table de `definition.ts`, les indications de la barre et tout terme employé par au moins deux mots complets), `indication-hors-crochets`, `numerotation`, `non-ferme`, `exemple-vide`, `genre-vide`, `genre-inconnu`, `espaces`, `point-final`, et `orthographe` (`orthographe.ts`). Une remarque porte sa `correction`, la définition entière corrigée, pour `balise`, `espaces` et `point-final` (sauf un sens qui finit par « , », « ; » ou « : ») ; null sinon. La classe `Atelier` en tire `remarquesFiche` (refaites à chaque frappe), `remarques(m)` et `aVerifier(m)`, sans les remarques tues. « Corriger » (`atelier.corriger`) prend la correction calculée sur le texte du moment, et la fiche la pose par la zone de saisie : seul le passage qui change est remplacé, par `execCommand`, pour que Ctrl+Z rende le texte d'avant. « C'est voulu » (`atelier.ignorer`) garde `id:code` ; pour l'orthographe, `id:orthographe:mot` pour chacun des mots signalés à ce moment. La fiche montre trois lignes au plus, la dernière finie par « et N autres », qui déplie le reste pour ce mot.

**Orthographe** (conception, section 15.4). `motsAVerifier` découpe une définition en mots à demander (chaque mot, et les morceaux d'un composé ou d'une élision), sans ce qui est entre crochets, les mots tout en majuscules, les lettres seules et les noms propres (une majuscule hors début de phrase). L'atelier demande ces mots au pont (`motsInconnus`) en arrière-plan : 300 ms après le dernier mot mis dans la file, par lots de 400, ceux de la fiche en tête ; la réponse de chaque mot est gardée pour la session. Un mot sans réponse n'est pas signalé. `motsInconnus(definition, dico, vedette)` écarte les abréviations (« fam. », « partic. »), les composés dont tous les morceaux sont connus et les formes du mot de la fiche ; `remarqueOrthographe` en fait une remarque, sans correction. Si le pont échoue, le dictionnaire est tenu pour absent jusqu'à la fin de la session, sans rien signaler.

**Propositions de correction** (`propositions.ts`). Un fichier `{ "format": 1, "propositions": [...] }` ; chaque proposition a `id` (du mot), `mot`, `champ` (`definition`, `genre` ou `sources`), `avant`, `apres`, `raison` et `certitude` (`forte` ou `faible`). Les entrées mal formées sont écartées. Une proposition vaut pour un mot (`appliquable`) quand son passage `avant` figure exactement une fois dans le champ (pour le genre, quand le genre vaut `avant`) et que la correction n'y est pas déjà faite ; `appliquer` remplace ce seul passage. `chargerPropositions` garde le sort des propositions déjà connues (par `cleProposition` : mot, champ, avant, après), et garde aussi celles déjà tranchées absentes du nouveau fichier : un refus ne revient pas. « Corriger » applique la proposition au brouillon ; elle devient `appliquee` quand le mot enregistré la porte. « Non » la rend `refusee`. Les propositions en attente comptent dans « À vérifier ».

**Historique sous Windows** (conception, section 15.5). `atelier.historiqueDuDepot()` demande au pont `historique()` et contrôle la réponse (`validerHistorique`) ; il rend null sur un échec, une réponse mal formée ou un historique vide.

Composants (`composants/atelier/`) :

- `BarreEnvoi.svelte` : le titre, le compteur (« Tout est envoyé », ou le nombre de modifications et leur détail) et « Envoyer au téléphone ».
- `ListeMots.svelte` : la recherche, les filtres Tous les mots, Complets, À compléter, À vérifier et Doublons avec leurs nombres (`compterFiltres`, qui reçoit `atelier.aVerifier`), la liste (`listerAtelier`), « Nouveau mot » et « Charger des propositions… » (un sélecteur de fichier caché sous un lien ; le fichier choisi est lu par `atelier.chargerPropositions`, puis le sélecteur est remis à zéro pour que le même fichier puisse revenir). Le filtre Doublons montre les groupes de mots liés par le même mot ou le même tri (`groupesDeDoublons`, les accents comptent), séparés par un filet ; une recherche y garde les groupes entiers. Flèches, Début et Fin parcourent la liste.
- `FicheAtelier.svelte` : sur la première ligne, Mot, Tri, Genre (avec les genres déjà employés en suggestion, `genresUtilises`), puis Note et Util., petits (environ 4 et 5 caractères) ; leur nom entier (« Utilisé dans mes livres », l'aide de la note) est dans `title`, et dans `aria-label` pour Util. Puis les avertissements quand le mot ou le tri existe déjà (`homonymes`), les remarques et propositions, la barre de balises et la Définition (le rappel des balises est le `title` du titre « Définition »), la Source (une ligne par livre, `lignesDeSources`). En bas, toujours visibles et sur une ligne : la case « À compléter », « Ouvrir dans le CNRTL » (`adresseCnrtl`) et « Supprimer ce mot », deux liens, puis « Enregistrer » (inactif tant que rien n'a changé ; Ctrl+S fait de même). Les réglages étroits suivent la largeur de la fiche (`container-type: inline-size`) : sous 640 px, marges et écarts réduits, et la première ligne donne au genre la place que cède le tri ; sous 500 px, les liens se disent « CNRTL » et « Supprimer » (nom entier dans `aria-label` et `title`) et les champs de la première ligne passent en 18 px.
- `Apercu.svelte` : la fiche telle qu'elle apparaîtra sur le téléphone (`Fiche.svelte`, dans un cadre de la largeur d'un téléphone), mise à jour pendant la saisie.

`Atelier.svelte` assemble le tout, montre les avis, le bouton « Reprendre la liste en ligne » tant que dure une divergence, et les questions. Sans copie lisible, il ne montre pas les colonnes, mais ce qui manque, avec « Réessayer » (et « Reprendre la liste en ligne » si la copie est illisible). Il signale au bureau, par le pont, qu'une fiche est modifiée. Changer d'onglet avec une fiche modifiée pose la question de l'atelier (`etat.retenirSortie`).

## L'enveloppe Windows (`apps/desktop`)

Electron 45, pour Windows x64. L'identifiant est `ch.noth.jolismots`, le nom « Jolis Mots ».

- `build.mjs` (`npm run build:desktop`) : esbuild fait de `src/main.ts` (avec `depot.ts` et le cœur) et de `src/preload.ts` deux fichiers CommonJS, `dist/main.cjs` et `dist/preload.cjs`, puis copie la construction de `apps/web` dans `dist/web` et l'icône à côté.
- `package.mjs` (`npm run package:desktop`) : electron-builder fabrique, selon la section `build` du `package.json` et avec le numéro du `package.json` racine, l'installeur `release/Jolis-Mots-<version>-setup.exe` (il laisse choisir le dossier d'installation) et la version portable `release/Jolis-Mots-<version>-portable.exe`. electron-builder passe par Windows PowerShell : le script vérifie d'abord qu'il démarre. L'application n'est pas signée : Windows signale un éditeur inconnu.
- `make-icons.mjs` (`npm run icons -w @jolis-mots/desktop`) tire `assets/icon.png` (512 px) et `assets/icon.ico` du dessin de l'icône Android, `apps/android/assets/icone.svg`.

### Le processus principal (`src/main.ts`)

- Il ouvre la page `dist/web/index.html` depuis le disque, sans serveur, dans une fenêtre isolée (`contextIsolation`, `sandbox`, sans `nodeIntegration`). Le fond de la fenêtre est le papier de Nuit ou de Papier selon le mode de Windows, pour éviter un éclair blanc.
- Une seule instance : relancer l'application ramène la fenêtre ouverte.
- La taille et la place de la fenêtre sont retenues dans `fenetre.json` (au moins 960 × 640 ; 1280 × 820 au premier lancement, ramenés à l'écran). Une place sur un écran débranché depuis est oubliée.
- Rien d'autre que la page ne s'ouvre dans l'application. « Ouvrir dans le CNRTL » n'ouvre dans le navigateur que les adresses qui commencent par `https://www.cnrtl.fr/definition/`.
- Les demandes du pont ne sont acceptées que de la page de la fenêtre, et leurs arguments sont vérifiés.
- Le menu propose « Recharger » (Ctrl+R), les outils de développement, le zoom et le plein écran. Recharger ou fermer la fenêtre avec une fiche modifiée demande d'abord : « Recharger sans enregistrer la fiche ? », « Quitter sans enregistrer la fiche ? ».

`src/preload.ts` pose le pont dans la page, sous `window.jolisMots`, et ne fait que passer chaque demande au processus principal : `motsInconnus` par `orthographe:inconnus`, `historique` par `depot:historique`, comme les autres.

### L'orthographe (`src/main.ts`, `src/orthographe.ts`)

- **Le correcteur de la fenêtre** : au démarrage, `session.defaultSession.setSpellCheckerLanguages(['fr'])`. Electron n'accepte que les codes de sa liste (`fr` ou `fr-FR`, pas `fr-CH`). Sous Windows, c'est le correcteur du système qui souligne : il faut le français parmi les langues de Windows, rien d'autre à installer. Si la langue est refusée, l'erreur est écrite dans le journal et la fenêtre garde son correcteur.
- **Les mots inconnus du vérificateur.** `webFrame.isWordMisspelled` rend toujours faux sous Windows (il ne connaît que les dictionnaires Hunspell, que Windows n'utilise pas), et le processus principal n'a pas d'API pour juger un mot. `orthographe.ts` (Node seul, sans Electron) interroge donc le même correcteur de Windows (ISpellChecker) par un Windows PowerShell, lancé à la première demande et gardé ouvert :
  - le programme est appelé par son chemin complet (`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`), par `spawn` sans shell, avec `-NoLogo -NoProfile -NonInteractive -EncodedCommand` : le script, fixe, est passé encodé (UTF-16, base 64) et ne contient aucun mot ;
  - il compile une petite enveloppe C# de l'interface COM, ouvre le correcteur en `fr`, puis `fr-FR`, puis `fr-CH`, et répond `PRET <langue>`, ou `SANS` sans dictionnaire français ;
  - les mots passent par l'entrée standard, un lot par ligne, en JSON écrit en ASCII seul (`\uXXXX`) : aucune page de codes ne peut les abîmer, et aucun n'est jamais sur une ligne de commande. La réponse est une ligne d'indices, contrôlés (entiers, dans les bornes) ;
  - les demandes passent une à une ; 60 secondes pour démarrer, 30 par demande. Un mot de plus de 64 caractères, ou avec un retour à la ligne, n'est pas demandé ; 2000 mots au plus par demande. Le gestionnaire IPC vérifie que la demande vient de la page et que c'est une liste de textes ;
  - aucune fonction ne lève : sans PowerShell, sans français, sur un délai dépassé ou une réponse illisible, le correcteur est mis hors service pour la session (la cause est écrite une fois dans le journal) et répond qu'aucun mot n'est inconnu. Il est fermé à `will-quit`, et s'arrête seul si l'application meurt (fin de son entrée standard).

### La copie locale de la liste (`src/depot.ts`)

L'atelier travaille sur un clone de la branche `donnees`, dans le dossier de données de l'application : `%APPDATA%\Jolis Mots\donnees`. Les fichiers mis de côté vont dans `%APPDATA%\Jolis Mots\sauvegardes`. `depot.ts` est du Node seul, sans Electron ; il appelle le `git` installé sur la machine par `execFile`, sans shell, avec `LC_ALL=C` et `GIT_TERMINAL_PROMPT=0` : l'application ne manipule aucun mot de passe ni jeton. Les opérations passent une à la fois, et aucune ne lève : une panne revient dans `raison` (`sans-git`, `sans-reseau`, `refus`, `divergence`, `erreur`) et dans `detail`, le message de git.

- **Ouvrir** lit ce qui est sur le disque, sans réseau : le `mots.json` de la copie et celui de `origin/donnees`.
- **Synchroniser** télécharge la copie si elle manque (`git clone --single-branch --branch donnees`, sans conversion des fins de ligne) ; un dossier sans copie utilisable (téléchargement interrompu, `HEAD` cassé) est d'abord mis de côté dans `sauvegardes/donnees-AAAA-MM-JJ-HHMMSS`, et s'il tenait un `mots.json`, le chemin de ce fichier revient dans `sauvegarde`. Sinon, `git fetch` : si la liste en ligne n'a pas bougé, rien à faire ; si elle a avancé et que rien n'attend ici, avance rapide ; sinon, divergence.
- **Enregistrer** écrit `mots.json` dans un fichier temporaire du même dossier (`mots.json.tmp`), écrit jusqu'au disque (`fsync`), puis le renomme : UTF-8 sans BOM, octets exacts.
- **Envoyer** écrit le fichier, va voir la liste en ligne, et s'arrête sur une divergence sans rien envoyer. Sinon, une seule version est faite à partir de la liste en ligne, avec le message de l'envoi (une version restée ici après un envoi manqué est refaite, sans que le fichier bouge), puis envoyée par `git push`. Jamais d'envoi en force.
- **Historique** (`historique`) lit, sans réseau et hors de la file des opérations, les versions de `mots.json` sur `origin/donnees` : `git log --format=%H --reverse -n 201`, puis toutes ces versions d'un seul `git cat-file --batch` (délai de 60 secondes). Une version illisible ou invalide (`validerFichier`) est sautée ; sans copie, ou si git échoue, null. Seules les `HISTORIQUE_MAX + 1` dernières sont lues : l'historique n'en garde pas plus. `historiqueEnCache` les passe à `historiqueDeListes` (le cœur) et garde le résultat tant que `origin/donnees` reste le même commit (`git rev-parse`) : rouvrir l'écran ne relit rien ; un échec n'est pas gardé.
- **Reprendre** copie d'abord `mots.json` dans `sauvegardes/mots-AAAA-MM-JJ-HHMMSS.json` (sans jamais écraser un fichier existant), puis remet la copie sur la liste en ligne. Seule la copie privée de l'atelier est touchée.

Les opérations réseau ont des délais : `git fetch` est arrêté au bout de 30 secondes, `git clone` au bout de 120, `git push` au bout de 5 minutes (le gestionnaire d'identifiants peut ouvrir une fenêtre de connexion). Une opération arrêtée rend `sans-reseau`. Les trois passent aussi `-c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30` : git abandonne lui-même un transfert qui reste sous 1000 octets par seconde pendant 30 secondes. Un refus d'identification (« could not read Username … terminal prompts disabled ») rend `refus`.

Deux variables d'environnement servent aux essais, pour que rien ne parte sur la vraie branche `donnees` :

- `JOLISMOTS_DEPOT` : l'adresse du dépôt de la liste (par défaut `https://github.com/iago-swi/jolis-mots.git`), par exemple un dépôt nu local ;
- `JOLISMOTS_DONNEES` : le dossier de données de l'application, qui remplace `%APPDATA%\Jolis Mots` (copie, sauvegardes, fenêtre, et verrou d'instance unique).

Les tests de `depot.test.ts` lancent le vrai `git` sur des dépôts temporaires.

## L'enveloppe Android (`apps/android`)

- Capacitor 8.6.2 ; identifiant `ch.noth.jolismots`, nom « Jolis Mots », `webDir` : `../web/dist`. Les chemins de l'application sont relatifs (`base: './'`), elle s'ouvre donc aussi bien d'un serveur que du paquet embarqué.
- Dans l'application Android seulement (`main.ts`), le bouton retour ferme d'abord la fiche ou le volet ouvert, puis les réglages, puis revient à l'écran Mot ; depuis Mot, il quitte.
- L'application reste en portrait : `ajuster-projet.mjs` ajoute `android:screenOrientation="portrait"` à l'activité principale du manifeste, après chaque `cap sync android`.
- `make-icons.mjs` dessine l'icône (les lettres « jm » en EB Garamond italique, changées en tracés) dans `assets/icone.svg` et écrit les icônes du lanceur. Il refait aussi l'écran de lancement, aux couleurs de Papier le jour et de Nuit en mode sombre : chaque `splash.png` de Capacitor devient un fond papier avec la marque au centre, avec sa version Nuit dans le dossier `-night` correspondant ; sur Android 12 et plus, le thème de lancement prend le fond `fond_lancement` et la marque `marque_lancement`, qui ont chacun leur version Nuit. Il tourne dans `npm run build:android`.
- La WebView est transparente (`backgroundColor: '#00000000'` dans `capacitor.config.ts`) : avant le premier affichage de la page, on voit le fond de la fenêtre, papier le jour et Nuit en mode sombre. Il n'y a donc plus d'éclair clair au lancement en mode sombre.
- `build-apk.mjs` fabrique l'APK (voir plus bas). `versionName` est le numéro du `package.json` racine ; `versionCode` vaut majeure × 10 000 + mineure × 100 + correctif (1.0.0 donne 10000).
- Le dossier `apps/android/android/` est **généré** par Capacitor et ignoré par git. Après un clonage neuf : `npx cap add android`, lancé depuis `apps/android`.

### Barres du système

Android 16 impose l'affichage bord à bord : la page peut passer sous la barre d'état et sous la barre de gestes.

- **Configuration** (`capacitor.config.ts`) : le greffon `SystemBars` de Capacitor reçoit `insetsHandling: 'css'` et `initialViewportFitValueHint: 'cover'` ; `index.html` demande aussi `viewport-fit=cover`. Capacitor donne alors à la page la hauteur des barres dans `--safe-area-inset-top` et `--safe-area-inset-bottom`.
- **Marges** (`app.css`) : `--marge-haut` et `--marge-bas` reprennent ces valeurs, à défaut `env(safe-area-inset-*)`, sinon zéro dans un navigateur ordinaire. L'en-tête commence sous la barre d'état (`Entete.svelte`) et les onglets restent au-dessus de la barre de gestes (`Onglets.svelte`) ; le fond de la page s'étend sous les deux.
- **Bord à bord ou non** (`apps/web/src/barres.ts`) : `webViewBordABord` lit la version de Chromium dans l'agent utilisateur. Capacitor ne met la WebView bord à bord qu'à partir de Chromium 140 ; avant, il la décale sous les barres, qui restent posées sur le fond de la fenêtre Android. Sans version lisible, la WebView est tenue pour bord à bord.
- **Couleur des icônes** (`main.ts`, `etat.suivreFondDesBarres`) : les icônes de la barre d'état et de la barre de gestes sont claires sur un fond sombre et sombres sur un fond clair (`SystemBars.setStyle`). Sur une WebView récente (bord à bord), le fond est celui de la palette affichée : les icônes suivent la palette (Nuit, ou « Comme le système » en mode sombre). Sur une WebView d'avant Chromium 140, le fond est celui de la fenêtre : les icônes suivent le mode de l'appareil. Elles changent aussitôt quand la palette ou le mode change.
- **Fond de la fenêtre** : `make-icons.mjs` écrit la couleur `fond_fenetre` (le papier de Papier dans `values`, celui de Nuit dans `values-night`) et l'ajoute comme `android:windowBackground` au thème `AppTheme.NoActionBar` de `styles.xml`. Sur une WebView d'avant Chromium 140, les barres sont donc posées sur le papier de Papier le jour et sur celui de Nuit en mode sombre, comme « Comme le système ».

### Signature

Depuis la 1.0.0, l'APK publié est signé avec une clé propre à Jolis Mots, gardée hors du dépôt :

- le fichier de clé est celui que nomme la variable `JOLISMOTS_KEYSTORE`, sinon `%USERPROFILE%\.jolis-mots\jolis-mots.jks` ; l'alias est `jolismots` ;
- `npm run cle:android` crée ce fichier avec le `keytool` du JDK, qui demande lui-même le mot de passe et le nom dans le terminal. Une clé existante n'est jamais remplacée ;
- `npm run package:android` fabrique l'APK (`assembleRelease`), l'aligne (`zipalign`), le signe (`apksigner`) et vérifie la signature. Le mot de passe est demandé dans le terminal, ou lu par `apksigner` dans la variable `JOLISMOTS_KEYSTORE_PASS` si elle existe ; le script ne l'écrit nulle part et ne le passe jamais sur une ligne de commande. Sans fichier de clé, il s'arrête avant de compiler ;
- `npm run package:android:debug` fabrique un APK de débogage (`assembleDebug`), signé avec la clé de débogage de la machine (`%USERPROFILE%\.android\debug.keystore`), dans `apps/android/release/Jolis-Mots-<version>-debug.apk`.

Android ne met à jour une application installée qu'avec un APK signé par la même clé. Passer de la clé de débogage de la 0.1.0 à cette clé oblige à désinstaller l'application une fois, ce qui efface les progrès et les favoris gardés sur le téléphone. Le fichier de clé et son mot de passe doivent être sauvegardés : sans eux, aucune mise à jour ne s'installera plus par-dessus l'application.

## Import depuis l'Excel (`tools/import`)

L'atelier est désormais la source des mots : sans l'option `--ecraser`, `npm run import` s'arrête avant d'écrire `donnees/mots.json` et le dit. Pour importer quand même, ce qui écrase la liste : `npm run import -- --ecraser`. Depuis la racine, l'import fait deux choses :

1. `extraire.py` (Python et `openpyxl`) lit la feuille « Philippe » de `vocabulaire.xlsx` en lecture seule et écrit `tools/import/sortie/lignes.json` : une ligne par mot, avec les colonnes Mot, Tri, Genre, Définition, Note, Util., Source, et un indicateur pour les lignes remplies en rouge.
2. `importer.ts` vérifie l'option `--ecraser`, appelle `importer` du cœur et écrit `donnees/mots.json` et le rapport `tools/import/sortie/rapport-import.md`.

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
| `npm test` | Les tests (Vitest). Environ une minute : les tests de la copie locale lancent le vrai `git`. |
| `npm run typecheck` | Contrôle des types (`tsc`). |
| `npm run build` | Fabrique l'application dans `apps/web/dist`. |
| `npm run check` | `typecheck`, puis `build`. |
| `npm run dev` | Serveur de développement sur `http://localhost:5173` (`?pont=demo#atelier` pour l'atelier). |
| `npm run import -- --ecraser` | Import depuis l'Excel (voir plus haut) ; sans `--ecraser`, refuse. |
| `npm run build:android` | `build`, puis `cap sync android`, les icônes et l'écran de lancement, et le portrait. |
| `npm run cle:android` | Crée le fichier de clé de signature Android. |
| `npm run package:android` | Met `donnees/` à jour, `build:android`, puis l'APK signé dans `apps/android/release/Jolis-Mots-<version>.apk`. |
| `npm run package:android:debug` | Comme `package:android`, mais l'APK de débogage, `Jolis-Mots-<version>-debug.apk`. |
| `npm run build:desktop` | `build`, puis assemble l'application Windows dans `apps/desktop/dist`. |
| `npm run start:desktop` | `build:desktop`, puis lance l'application Windows. |
| `npm run package:desktop` | Met `donnees/` à jour, `build:desktop`, puis l'installeur et la version portable dans `apps/desktop/release/`. |
| `npm run captures` | Refait les captures du README dans `docs/captures/`. |

`vitest.config.ts` charge le greffon Svelte (les fichiers `.svelte.ts` utilisent les runes), lit les tests de `packages/` et de `apps/`, et laisse 20 secondes à chaque test. `volet.test.ts` tourne dans `happy-dom`, les autres dans Node.

### Mettre `donnees/` à jour avant une fabrication

`scripts/maj-donnees.mjs` tourne au début de `package:android`, `package:android:debug` et `package:desktop`, pour que la liste embarquée soit la dernière envoyée par l'atelier. Il ne fait que lire la liste en ligne : `git fetch`, puis, s'il y a du nouveau, `git pull --ff-only`. Rien n'est jamais validé ni envoyé. Sans réseau, il prévient et la fabrication continue avec la liste déjà là. Il s'arrête en disant quoi faire si `donnees/` manque, n'est pas sur la branche `donnees` suivie en ligne, a été modifié à la main, ou porte des versions que la liste en ligne n'a pas.

## Mettre en route après un clonage

1. `npm install`.
2. La liste des mots. `donnees/mots.json` est la branche `donnees`, montée en dossier de travail (worktree) et ignorée sur la branche de code. Sans elle, `typecheck` et `build` échouent :

   ```bash
   git worktree add donnees donnees
   ```

3. Pour Android seulement, le projet généré : `npx cap add android`, depuis `apps/android`. Pour un APK publié, le fichier de clé (voir « Signature »).
4. Pour Windows, `npm run start:desktop` lance l'application. Hors de l'application installée, elle refuse de démarrer sans `JOLISMOTS_DONNEES` : elle le dit dans le terminal et s'arrête, avant d'ouvrir une fenêtre ou de créer un dossier. Sans cette garde, un essai travaillerait sur la vraie copie de la liste (`%APPDATA%\Jolis Mots`), à un clic de la branche `donnees` en ligne. Pour un essai, un dépôt nu local et un dossier de données à part, depuis PowerShell, à la racine :

   ```powershell
   $essai = "$env:TEMP\jolis-mots-essai"
   git clone --bare --single-branch --branch donnees . "$essai\depot.git"
   $env:JOLISMOTS_DEPOT = "$essai\depot.git"
   $env:JOLISMOTS_DONNEES = "$essai\donnees"
   npm run start:desktop
   ```

   L'atelier télécharge alors sa copie depuis `depot.git`, et ses envois n'y vont que là. Supprimer le dossier `$essai` après l'essai.

## Fabriquer l'APK

`npm run package:android` demande :

- **Un JDK entre 17 et 24.** Gradle 8.14 ne démarre pas sur un Java plus récent, et le greffon Android veut au moins le 17. `build-apk.mjs` prend `JAVA_HOME` s'il convient, sinon cherche un JDK dans `C:\Program Files\Eclipse Adoptium`, `C:\Program Files\Java`, `C:\Program Files\Microsoft` ou `/usr/lib/jvm`, pour cette fabrication seulement. Sur cette machine : Temurin 21 (`winget install EclipseAdoptium.Temurin.21.JDK`). Sans JDK convenable, le script s'arrête en le disant.
- **Le SDK Android**, dans `ANDROID_HOME` ou, à défaut, `C:\Android\Sdk`, avec ses `build-tools` (pour `zipalign` et `apksigner`).
- **Le fichier de clé** (voir « Signature ») et son mot de passe. `package:android:debug` n'en a pas besoin.
- **PowerShell sur cette machine.** Lancée depuis Git Bash, la fabrication Gradle échoue (« Unable to establish loopback connection »). Lancer la commande depuis PowerShell.

## Captures d'écran

`npm run captures` fabrique l'application, la sert sur un port local libre, la photographie avec Edge sans fenêtre (piloté par son protocole de débogage), puis écrit `mot.png`, `quiz.png`, `question.png`, `recueil.png`, `reglages.png`, `atelier.png` et `palettes.png` dans `docs/captures/`.

- Avant les photos, il vérifie que les filtres du Recueil tiennent sur une ligne d'un écran de 411 px de large, au départ puis avec l'autre auteur au nom le plus long choisi, et s'arrête sinon.
- Edge sans fenêtre ne descend pas sous 500 px de large : le script émule donc un écran de 411 × 890 px, la largeur du téléphone de Philippe, et impose le mode clair, car les pastilles « Comme le système » des Réglages suivent le mode sombre de la machine.
- Les adresses fixent le mot (`?mot=baguenauder`, `?mot=ceruleen` pour `palettes.png`) et la palette (`?palette=papier`). `quiz.png` montre le choix du quiz ; `question.png` le saute (`?quiz=vus`) et interroge sur « Baguenauder », le seul mot vu jusque-là. Les trois mauvaises réponses sont tirées au hasard : elles changent d'une exécution à l'autre.
- `atelier.png` est prise à 1280 × 800 avec le pont de démonstration (`?pont=demo#atelier`). Aucune adresse n'ouvre un mot dans l'atelier : le script touche la ligne « Vénuste » de la liste, puis vérifie que la fiche s'est ouverte. On y voit la première ligne avec Note et Util., la remarque du vérificateur sur le point final du sens 2 et la barre de balises.

## Versions et publication

Une seule version pour tout le dépôt, dans le `package.json` racine ; les `package.json` des paquets portent le même numéro. `version.ts` la donne à Vite, qui l'écrit dans l'application (écran Réglages) et dans la balise `<meta name="version">`. L'APK et les fichiers Windows prennent aussi le numéro du `package.json` racine. Les règles de numérotation et de publication sont dans [VERSIONING.md](VERSIONING.md) ; le flux `.github/workflows/release.yml` publie sur GitHub la section du [journal](CHANGELOG.md) à chaque étiquette `vX.Y.Z`.
