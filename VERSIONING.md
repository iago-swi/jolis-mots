# Versions et notes de version

Jolis Mots est un seul produit, avec un seul numéro de version, un journal des modifications ([CHANGELOG.md](CHANGELOG.md)) et une publication GitHub par version.

Versions publiées : <https://github.com/iago-swi/jolis-mots/releases>

## Règles

1. Tout changement que l'utilisateur peut remarquer donne une nouvelle version, avec une section dans `CHANGELOG.md`. Le changement est terminé quand sa version est publiée sur GitHub. Plusieurs changements envoyés ensemble font une seule version, numérotée selon le plus important.
   Un changement de documentation seule (README, capture d'écran) ne donne ni version, ni étiquette, ni publication. Il passe par une demande de fusion comme les autres et peut être cité sous `Documentation` dans les notes de la version suivante.
2. La version s'écrit `X.Y.Z` :
   - `Z` augmente quand quelque chose est corrigé ou ajusté sans rien ajouter : correction, réglage, formulation, finition visuelle.
   - `Y` augmente quand l'utilisateur gagne quelque chose : une fonction, un écran, un réglage. `Z` revient à 0.
   - `X` augmente pour une refonte, ou un changement qui rend inutilisables les progrès ou les données enregistrés. `Y` et `Z` reviennent à 0.
3. L'étiquette est `v` suivi de la version : `v1.2.0`.
4. Une étiquette envoyée n'est jamais déplacée ni supprimée. Une erreur se corrige par une nouvelle version.
5. L'application affiche sa version dans ses réglages. La version vit dans le `package.json` à la racine ; la publication est refusée si ce numéro diffère de l'étiquette.
6. Les notes de version sont écrites en français, pour l'utilisateur, en langage simple.

## La liste des mots n'est pas une version

L'atelier envoie la liste des mots, `mots.json`, sur la branche `donnees`. Cet envoi se fait directement depuis l'application, sans demande de fusion, et ne donne ni version ni étiquette. La branche `donnees` ne contient rien d'autre et n'est jamais fusionnée dans `main`.

## Publier un changement

Tout changement arrive sur `main` par une branche et une demande de fusion. Rien n'est validé ni envoyé directement sur `main`. `main` n'est jamais envoyée en force et son historique n'est pas réécrit.

Quand Philippe dit **« publie »**, faire toutes les étapes ci-dessous. Quand il dit **« ouvre une demande de fusion »**, s'arrêter après l'étape 4 et donner le lien.

1. Mettre `main` à jour et créer une branche :

   ```bash
   git switch main
   git pull --ff-only
   git switch -c release/jolis-mots-v1.2.0
   ```

   La branche s'appelle `release/jolis-mots-vX.Y.Z` pour une version et `docs/<nom-court>` pour un changement de documentation seule.

2. Pour une version, ajouter une section en tête de `CHANGELOG.md`, au-dessus de la version précédente :

   ```markdown
   ## [1.2.0] - 2026-12-03

   ### Ajouté

   - Ce que l'utilisateur peut faire désormais, en une phrase simple.
   ```

   Utiliser les titres qui s'appliquent : `Ajouté`, `Modifié`, `Corrigé`, `Retiré`, `Documentation`. Ajouter en bas du fichier la ligne de lien de la nouvelle version. Mettre le même numéro dans le `package.json` de la racine.

3. Valider sur la branche, le journal avec le changement, sous l'identité Git de Philippe. Le message est simple et ne porte aucune ligne d'attribution (ni `Co-Authored-By`, ni `Generated with`).

4. Envoyer la branche et ouvrir une demande de fusion :

   ```bash
   git push -u origin release/jolis-mots-v1.2.0
   gh pr create --base main --title "Jolis Mots 1.2.0 : quelques mots" --body-file notes.md
   ```

   Le titre est le numéro de version suivi de quelques mots. Le texte est la section du journal pour cette version. Un changement de documentation n'a pas de version : son titre et son texte disent ce qui a changé.

5. Fusionner avec un commit de fusion, sans écrasement ni rebasage :

   ```bash
   gh pr merge --merge --delete-branch
   ```

6. Un changement de documentation s'arrête ici. Pour une version, poser l'étiquette sur le commit de fusion et l'envoyer seule :

   ```bash
   git switch main
   git pull --ff-only
   git tag -a v1.2.0 -m "Jolis Mots 1.2.0"
   git push origin v1.2.0
   ```

7. L'envoi de l'étiquette lance la [publication automatique](.github/workflows/release.yml). Elle lit dans le journal la section de cette version et la publie sur GitHub sous le titre « Jolis Mots 1.2.0 ». Joindre ensuite les fichiers à télécharger :

   ```bash
   gh release upload v1.2.0 chemin/vers/Jolis-Mots-1.2.0.apk chemin/vers/Jolis-Mots-1.2.0-setup.exe
   gh release view v1.2.0
   ```

## Corriger une note de version

Corriger le journal et le publier par une demande de fusion `docs/`. Relancer ensuite la publication pour l'étiquette existante, ce qui remplace les notes et garde les fichiers joints :

```bash
gh workflow run release.yml -f tag=v1.2.0
```

La même commande publie une version dont la publication automatique a échoué.
