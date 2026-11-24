# Journal des modifications de Jolis Mots

Toutes les versions de Jolis Mots, de la plus récente à la plus ancienne. Les règles sont dans [VERSIONING.md](VERSIONING.md).

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

[0.1.0]: https://github.com/iago-swi/jolis-mots/releases/tag/v0.1.0
