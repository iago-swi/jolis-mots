/**
 * Fabrique l'installeur et la version portable pour Windows x64 (dans `release/`),
 * selon la section `build` du package.json, avec la version du `package.json` racine :
 * comme `-c.extraMetadata.version=…` en ligne de commande, elle nomme les fichiers produits.
 *
 * Lancer après `npm run build:desktop` : npm run package -w @jolis-mots/desktop
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, Platform } from 'electron-builder';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(path.join(ICI, '..', '..', 'package.json'), 'utf8')).version;

function echec(raison) {
  console.error(`\nLa fabrication de l'installeur a échoué : ${raison}`);
  console.error("Fermer cette fenêtre de commande, en ouvrir une nouvelle (au besoin, redémarrer Windows) et relancer : npm run package:desktop");
  process.exit(1);
}

// electron-builder interroge npm par Windows PowerShell (powershell.exe). S'il ne démarre pas
// (vu une fois : code 3221225794, échec d'initialisation), le dire avant de commencer.
const essai = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], { stdio: 'ignore' });
if (essai.status !== 0) {
  echec(`Windows PowerShell ne démarre pas (${essai.error?.message ?? `code ${essai.status}`}) ; electron-builder en a besoin.`);
}

// Une erreur d'electron-builder peut aussi arriver hors de la promesse de build.
process.on('unhandledRejection', (e) => echec(e instanceof Error ? e.message : String(e)));

try {
  await build({
    projectDir: ICI,
    targets: Platform.WINDOWS.createTarget(),
    publish: 'never',
    config: { extraMetadata: { version: VERSION } },
  });
} catch (e) {
  echec(e instanceof Error ? e.message : String(e));
}
