# Consignes pour les assistants

Jolis Mots est une application Android et Windows pour apprendre des mots français rares. Lire d'abord la [conception](docs/superpowers/specs/2026-11-24-jolis-mots-design.md).

- Suivre [VERSIONING.md](VERSIONING.md) : rien n'est validé ni envoyé directement sur `main` ; tout passe par une branche et une demande de fusion, fusionnée avec un commit de fusion. Ne jamais déplacer ni supprimer une étiquette envoyée.
- Valider sous l'identité Git du propriétaire, avec un message simple et sans ligne d'attribution.
- La documentation, les notes de version et les textes de l'application sont en français. Écrire seulement ce que le code et les documents existants montrent.
- `vocabulaire.xlsx` est l'archive personnelle du propriétaire : ne jamais l'ajouter au dépôt, ni le modifier.
- La branche `donnees` ne contient que `mots.json`. Seul l'atelier de l'application y écrit.
- Le texte des définitions saisi par le propriétaire fait référence : aucun traitement ne doit en perdre ou en modifier un caractère dans les données enregistrées.

## Commandes

Depuis la racine. Le détail est dans [PROJET.md](PROJET.md).

- `npm test` : les tests (Vitest). `npm run check` : contrôle des types puis fabrication (`svelte-check` n'est pas utilisé).
- `npm run dev` : serveur de développement. `npm run import` : import depuis `vocabulaire.xlsx` vers `donnees/mots.json`.
- `npm run package:android` : l'APK, dans `apps/android/release/`. `npm run captures` : refait les captures du README.

## À savoir

- `donnees/` est un worktree de la branche `donnees` (`git worktree add donnees donnees` après un clonage), ignoré sur la branche de code. Sans `donnees/mots.json`, `npm run check` et `npm run build` échouent.
- `apps/android/android/` est généré par `npx cap add android` (depuis `apps/android`) et ignoré par git.
- L'APK demande un JDK entre 17 et 24 et le SDK Android. Sur la machine du propriétaire, lancer la fabrication Gradle depuis PowerShell : depuis Git Bash, elle échoue (« Unable to establish loopback connection »).
