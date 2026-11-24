# Consignes pour les assistants

Jolis Mots est une application Android et Windows pour apprendre des mots français rares. Lire d'abord la [conception](docs/superpowers/specs/2026-11-24-jolis-mots-design.md).

- Suivre [VERSIONING.md](VERSIONING.md) : rien n'est validé ni envoyé directement sur `main` ; tout passe par une branche et une demande de fusion, fusionnée avec un commit de fusion. Ne jamais déplacer ni supprimer une étiquette envoyée.
- Valider sous l'identité Git du propriétaire, avec un message simple et sans ligne d'attribution.
- La documentation, les notes de version et les textes de l'application sont en français. Écrire seulement ce que le code et les documents existants montrent.
- `vocabulaire.xlsx` est l'archive personnelle du propriétaire : ne jamais l'ajouter au dépôt, ni le modifier.
- La branche `donnees` ne contient que `mots.json`. Seul l'atelier de l'application y écrit.
- Le texte des définitions saisi par le propriétaire fait référence : aucun traitement ne doit en perdre ou en modifier un caractère dans les données enregistrées.
