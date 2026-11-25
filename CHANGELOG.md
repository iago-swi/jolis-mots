# Journal des modifications de Jolis Mots

Toutes les versions de Jolis Mots, de la plus récente à la plus ancienne. Les règles sont dans [VERSIONING.md](VERSIONING.md).

## [1.0.4] - 2026-11-25

### Ajouté

- Sur le téléphone, quand une nouvelle liste ajoute, modifie ou supprime des mots, une petite annonce le dit quelques secondes en haut de l'écran : « Liste mise à jour · +2 · ~1 → 1 139 mots ». La toucher ouvre l'historique de la liste, sur cette entrée dépliée. Il n'y a pas d'annonce pour une liste qui ne change aucun mot visible.

## [1.0.3] - 2026-11-25

### Ajouté

- Dans l'atelier, une barre de balises au-dessus de la définition : `1.`, `[Litt.]`, `[Fig.]`, `[Par ext.]`, `[Vieux]`, `[Fam.]`, `EX:`, `SYN:`, `US:`, et « ⋯ » pour les autres (`[Par anal.]`, `[Par méton.]`, `[Par métaph.]`, `[Vieilli]`, `[Péj.]`, `[Pop.]`, `[Rare]`, `ANTON:`). Un clic insère la balise là où se trouve le curseur ; `1.` passe à la ligne et donne le numéro du sens suivant.
- Des abréviations à taper dans la définition, suivies de la touche Tab : `fig` devient `[Fig.] `, `ex` devient `EX: `, `n` passe à la ligne avec le numéro du sens suivant… Le survol d'un bouton de la barre montre son abréviation. Ctrl+Z annule une insertion comme une frappe.
- Un vérificateur des mots complets. Au-dessus de la définition, la fiche montre ce qui cloche : balise mal écrite (`EX :`, `Syn:`), indication écrite autrement que d'habitude (`[littér.]` pour `[Litt.]`) ou placée hors des crochets, numérotation des sens qui saute, crochet, parenthèse ou guillemet non fermé, `EX:` sans exemple, genre vide ou inconnu, espace double ou avant un point (avec les passages cités), point final manquant à la fin d'un sens, mot inconnu du dictionnaire français.
- « Corriger » répare d'un clic une balise mal écrite, des espaces en trop ou un point final manquant. Rien ne change sans ce clic, et Ctrl+Z rend le texte d'avant. « C'est voulu » fait taire cette sorte de remarque pour ce mot, durablement, sur cet ordinateur.
- Au-delà de trois remarques, « et N autres » montre le reste.
- Un cinquième filtre dans la liste de l'atelier, « À vérifier », avec son nombre : les mots complets qui ont une remarque, et les mots qui ont une proposition de correction.
- « Charger des propositions… », sous la liste, lit un fichier de propositions de correction. Chaque proposition apparaît dans la fiche de son mot, « avant → après » avec sa raison : « Corriger » l'applique à la fiche, « Non » l'écarte pour de bon. Un « ? » signale une proposition incertaine.

### Modifié

- Sous Windows, le correcteur souligne les fautes en français, et non plus en anglais. Il se sert du français installé dans Windows.
- Sous Windows, l'historique de la liste est tiré de la liste en ligne : il montre les listes envoyées depuis le premier import (les 200 dernières au plus), et non plus seulement depuis l'installation de la version 1.0.2. Le téléphone garde son propre historique.
- Dans la fiche de l'atelier, Note et « Utilisé dans mes livres » deviennent deux petits champs sur la première ligne, après Genre, sous les noms courts « Note » et « Util. ». La place gagnée va à la définition. Dans une fenêtre étroite, Genre, Note et Util. passent sur une deuxième ligne : aucun genre n'est coupé.
- Dans la fiche de l'atelier, le pied tient sur une ligne : la case « À compléter », les liens « Ouvrir dans le CNRTL » et « Supprimer ce mot », puis « Enregistrer ». Dans une fenêtre étroite, les liens se disent « CNRTL » et « Supprimer ».
- Le rappel des balises habituelles apparaît au survol du titre « Définition ».

## [1.0.2] - 2026-11-25

### Ajouté

- Dans les réglages, « Historique de la liste » : chaque nouvelle liste reçue, de la plus récente à la plus ancienne, avec sa date et son heure, ce qui a changé et le nombre de mots. Une entrée se déplie sur ses mots, par ordre alphabétique : « + » pour un mot ajouté, « ~ » pour un mot modifié, « − » pour un mot supprimé. Toucher un mot ajouté ou modifié ouvre sa fiche.
- L'historique commence à l'installation de cette version, avec le nombre de mots du moment.

## [1.0.1] - 2026-11-25

### Modifié

- Les filtres du Recueil : Bouvier, Tesson, Rollin, l'étoile des favoris et « Autres ». Méral passe sous « Autres », ce qui laisse la place au nom de l'auteur choisi.
- La fiche d'un mot n'affiche plus les pages : l'auteur et l'ouvrage suffisent.
- Dans les réglages, la liste des mots indique l'heure de son envoi en plus de la date (« 25 novembre 2026 à 03:44 »).

### Corrigé

- Au quiz, « Synonymes » est suivi d'une espace fine avant les deux-points, comme les autres textes de l'application.
- Dans l'atelier, une fois la liste reçue, la phrase « L'atelier a besoin d'une connexion une première fois… » s'efface ; le chemin de l'ancienne copie mise de côté reste affiché.
- Dans l'atelier, le message de git affiché sous une alerte est celui de l'échec qu'elle raconte, et non celui d'une vérification faite plus tard.
- Dans l'atelier, un envoi qui n'aboutit pas en cinq minutes est dit « L'envoi a échoué », et non « Pas de réseau ».

## [1.0.0] - 2026-11-25

La version Windows, avec l'atelier pour ajouter, modifier et supprimer des mots, puis envoyer la liste au téléphone. Sur le téléphone, la lecture n'a plus de fin et le quiz se choisit.

**Sur Android, il faut désinstaller la version 0.1.0 avant d'installer la 1.0.0. L'application est maintenant signée avec une nouvelle clé, et Android refuse d'installer la 1.0.0 par-dessus la 0.1.0. La désinstallation efface les progrès et les favoris gardés sur le téléphone. Ce n'est à faire qu'une fois.**

### Ajouté

- L'application pour Windows, en deux fichiers au choix : un installeur (`Jolis-Mots-1.0.0-setup.exe`) et une version portable, qui se lance sans installation (`Jolis-Mots-1.0.0-portable.exe`). On y trouve les écrans Mot, Quiz et Recueil, et un quatrième onglet : l'Atelier.
- L'application Windows n'est pas signée : à l'installation, Windows prévient que l'éditeur est inconnu.
- La fenêtre de Windows retrouve sa taille et sa place d'une fois à l'autre. L'application ne s'ouvre qu'une fois : la relancer ramène la fenêtre déjà ouverte.
- L'atelier montre tous les mots, complets ou non, avec une recherche et quatre filtres : Tous les mots, Complets, À compléter et Doublons. Chaque filtre indique son nombre de mots.
- Le filtre Doublons réunit côte à côte les mots qui ont le même mot ou le même tri, pour choisir lequel garder. Une recherche y garde les groupes entiers.
- La fiche de l'atelier : Mot, Tri, Genre, Définition, Source, Note, « Utilisé dans mes livres », et la case « À compléter ». Le tri est proposé à partir du mot. Un avertissement apparaît si le mot ou le tri existe déjà.
- Un mot coché « À compléter » reste dans l'atelier et n'apparaît pas sur le téléphone. La case est cochée d'office pour un nouveau mot.
- L'aperçu, à côté de la fiche, montre le mot tel qu'il apparaîtra sur le téléphone, pendant la saisie.
- « Ouvrir dans le CNRTL » ouvre l'article du mot dans le navigateur.
- Les boutons de la fiche restent visibles en bas. « Enregistrer » est inactif tant que rien n'a changé ; Ctrl+S enregistre aussi.
- Quitter une fiche modifiée sans l'enregistrer demande confirmation, de même que recharger ou fermer la fenêtre. Supprimer un mot demande confirmation.
- « Envoyer au téléphone » publie la liste modifiée. À côté, un compteur dit combien de mots ont été ajoutés, modifiés ou supprimés depuis le dernier envoi. Après l'envoi, l'atelier dit : « Liste envoyée. Le téléphone la verra dans quelques minutes. »
- L'atelier refuse d'envoyer une liste vide, ou une liste où deux mots portent le même identifiant.
- Quand l'envoi échoue, faute de réseau ou parce que GitHub le refuse, l'atelier le dit en clair, et les modifications restent en attente.
- Si la liste en ligne a changé ailleurs, rien n'est envoyé. « Reprendre la liste en ligne » met d'abord la version de l'atelier de côté, dans un fichier daté, puis prend la liste en ligne. L'atelier n'écrase jamais la liste en ligne.
- L'atelier a besoin de `git`, installé sur la machine et autorisé à envoyer sur le dépôt de Jolis Mots. Sans `git`, les écrans Mot, Quiz et Recueil fonctionnent avec la liste fournie avec l'application.
- Le quiz au choix : « Tous les mots » ou « Les mots que j'ai vus ». Chaque choix indique combien de mots il couvre. Dans « Les mots que j'ai vus », les mots à revoir passent d'abord.
- Le nombre de questions par quiz, dans les réglages : 5, 10, 15 ou 20 (10 au départ). À la fin d'un quiz, « Encore un quiz » ou « Lire des mots ».
- Les filtres Rollin et Méral dans le Recueil.

### Modifié

- La lecture n'a plus de séance ni de compteur : « Mot suivant » montre toujours un autre mot. L'écran Mot ne propose plus le quiz, et le réglage du nombre de mots par séance disparaît.
- Une bonne réponse ne fait monter un mot que s'il est à revoir ce jour-là. Refaire un quiz le même jour ne fait plus brûler les étapes.
- Un mot rencontré pour la première fois dans un quiz reste à lire sur l'écran Mot.
- Les filtres du Recueil sont plus petits et tiennent sur une ligne : Bouvier, Tesson, Rollin, Méral, l'étoile des favoris et « Autres ». Le bouton « Tous » disparaît : toucher le filtre allumé l'éteint.
- Le mot s'affiche toujours à la même grande taille, et une expression passe à la ligne entre ses mots. Seul un mot d'un seul tenant trop long pour une ligne prend une taille plus petite.
- Sur le téléphone, l'application reste en portrait.

### Corrigé

- Une définition qui commence par une phrase placée avant le « 1. » (« Éployer », « Musarder ») est maintenant découpée en sens numérotés. La phrase s'affiche au-dessus des sens.
- Une longue indication entre crochets s'affiche en italique, plus facile à lire que les petites capitales.
- En mode sombre, l'écran de lancement est sombre lui aussi, et l'éclair clair au lancement a disparu.
- Au clavier, les volets et les questions reçoivent le curseur à l'ouverture et le rendent à la fermeture. La touche Échap les ferme.
- Le téléphone refuse une liste en ligne vide, ou dont deux mots portent le même identifiant.
- Dans les textes de l'application, une espace fine insécable précède « ? », « : » et « ; » : un point d'interrogation ne se retrouve plus seul au début d'une ligne.

## [0.1.0] - 2026-11-24

Première version : l'application Android. La version Windows et l'atelier pour modifier les mots viendront avec la version 1.0.0.

### Ajouté

- L'écran Mot : un mot s'affiche dès l'ouverture, avec sa nature, ses sens, ses synonymes, un exemple et les livres où il a été rencontré. On passe au mot suivant d'un bouton ou d'un glissement du doigt, et on peut mettre un mot en favori.
- Des séances de lecture de 5 mots, ou de 6, 8 ou 10 au choix dans les réglages. À la fin, on peut lire encore un mot ou passer au quiz.
- Le quiz : une définition et quatre mots au choix, ou un mot et quatre définitions. Il pose les questions sur les mots de la séance, puis sur cinq mots à revoir au plus. Il n'y a ni points ni série.
- Une mémoire des mots : un mot réussi revient plus tard (après 1, 3, 7, 16 puis 35 jours) jusqu'à ce qu'il soit acquis ; un mot raté revient le lendemain.
- Le recueil : tous les mots qui ont une définition, par ordre alphabétique, avec une recherche sans accents, un filtre par auteur (Bouvier, Tesson, ou un autre auteur de la liste) et un filtre des favoris.
- Les réglages : le nombre de mots par séance, la palette, la version, la date de la liste des mots, et un bouton pour effacer ses progrès.
- Quatre palettes, Papier, Nuit, Ivoire et Céruléen, et un choix « Comme le système » qui suit le mode sombre du téléphone.
- La mise à jour de la liste en ligne : quand le téléphone a du réseau, l'application récupère au démarrage la dernière liste des mots et l'adopte au prochain mot qu'elle tire. Sans réseau, elle fonctionne avec la liste qu'elle a.
- Un fichier à installer sur Android (`Jolis-Mots-0.1.0.apk`), avec une icône et un écran de lancement.

[1.0.3]: https://github.com/iago-swi/jolis-mots/releases/tag/v1.0.3
[1.0.2]: https://github.com/iago-swi/jolis-mots/releases/tag/v1.0.2
[1.0.1]: https://github.com/iago-swi/jolis-mots/releases/tag/v1.0.1
[1.0.0]: https://github.com/iago-swi/jolis-mots/releases/tag/v1.0.0
[0.1.0]: https://github.com/iago-swi/jolis-mots/releases/tag/v0.1.0
