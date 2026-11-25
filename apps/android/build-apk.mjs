/**
 * Fabrique l'APK Android.
 *
 * Sans option, l'APK est signé avec la clé propre à Jolis Mots : `assembleRelease`,
 * puis `zipalign`, puis `apksigner`. Avec `--debug`, c'est l'APK de débogage,
 * signé par la clé de débogage de la machine.
 *
 * La clé vit hors du dépôt : `JOLISMOTS_KEYSTORE`, sinon
 * `%USERPROFILE%\.jolis-mots\jolis-mots.jks`, alias `jolismots`. Son mot de passe
 * n'est jamais écrit ni passé sur une ligne de commande : si
 * `JOLISMOTS_KEYSTORE_PASS` existe, apksigner la lit lui-même ; sinon il le
 * demande dans le terminal. `--creer-cle` crée ce fichier (`npm run cle:android`).
 *
 * Le script sert aussi à trouver le bon JDK. Gradle refuse de démarrer sur une JVM
 * plus récente que celles qu'il connaît : sur cette machine, le Java du système est
 * le 25 et Gradle s'arrête au 24 (« Unsupported class file major version 69 »).
 * On prend donc JAVA_HOME s'il convient, sinon un JDK installé dans la plage
 * acceptée, pour cette construction seulement. Le Java du système n'est pas touché.
 *
 * Le numéro de version vient du `package.json` racine : `versionName` le reprend
 * tel quel, `versionCode` vaut majeure × 10000 + mineure × 100 + correctif.
 * Le dossier `android/` est généré (et ignoré par git) : on y écrit ces deux
 * valeurs à chaque construction plutôt que de les régler à la main.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(path.join(ICI, '..', '..', 'package.json'), 'utf8')).version;
const PROJET = path.join(ICI, 'android');
const WINDOWS = process.platform === 'win32';

/** Gradle 8.14 accepte Java jusqu'au 24 ; le greffon Android demande au moins le 17. */
const JAVA_MIN = 17;
const JAVA_MAX = 24;

const RACINES_JDK = [
  'C:\\Program Files\\Eclipse Adoptium',
  'C:\\Program Files\\Java',
  'C:\\Program Files\\Microsoft',
  '/usr/lib/jvm',
];

const CLE_PAR_DEFAUT = path.join(os.homedir(), '.jolis-mots', 'jolis-mots.jks');
const ALIAS = 'jolismots';
const VARIABLE_MOT_DE_PASSE = 'JOLISMOTS_KEYSTORE_PASS';

function arreter(message) {
  console.error(message);
  process.exit(1);
}

function estDossier(chemin) {
  return existsSync(chemin) && statSync(chemin).isDirectory();
}

function versionCode(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`version illisible : ${version}`);
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

function majeureJava(home) {
  const bin = path.join(home, 'bin', WINDOWS ? 'java.exe' : 'java');
  if (!existsSync(bin)) return null;
  const sortie = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  const texte = `${sortie.stdout ?? ''}${sortie.stderr ?? ''}`;
  const m = texte.match(/version "(\d+)/);
  return m ? Number(m[1]) : null;
}

function trouverJdk() {
  const duSysteme = process.env['JAVA_HOME'];
  if (duSysteme) {
    const v = majeureJava(duSysteme);
    if (v && v >= JAVA_MIN && v <= JAVA_MAX) return { home: duSysteme, version: v };
  }
  for (const racine of RACINES_JDK) {
    if (!existsSync(racine)) continue;
    for (const entree of readdirSync(racine)) {
      const home = path.join(racine, entree);
      const v = majeureJava(home);
      if (v && v >= JAVA_MIN && v <= JAVA_MAX) return { home, version: v };
    }
  }
  return null;
}

/** Compare deux numéros « 36.0.0 » chiffre par chiffre. */
function comparerVersions(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Le dossier `build-tools` de version la plus haute du SDK. */
function trouverBuildTools(sdk) {
  const racine = path.join(sdk, 'build-tools');
  if (!estDossier(racine)) return null;
  const versions = readdirSync(racine)
    .filter((v) => /^\d+(\.\d+)*$/.test(v))
    .sort(comparerVersions);
  return versions.length ? path.join(racine, versions[versions.length - 1]) : null;
}

/**
 * Lance un programme. Windows a besoin d'un shell pour un .bat, et le shell coupe
 * les chemins à leurs espaces : une seule commande dont chaque morceau est entre
 * guillemets règle les deux.
 */
function lancer(programme, args, options) {
  return WINDOWS
    ? spawnSync([programme, ...args].map((a) => `"${a}"`).join(' '), { ...options, shell: true })
    : spawnSync(programme, args, options);
}

function jdkOuArret() {
  const jdk = trouverJdk();
  if (!jdk) {
    arreter(
      `Aucun JDK entre ${JAVA_MIN} et ${JAVA_MAX}, et Gradle ne démarre sur rien de plus récent.\n\n` +
        `  winget install EclipseAdoptium.Temurin.21.JDK\n`,
    );
  }
  console.log(`JDK ${jdk.version} : ${jdk.home}`);
  return jdk;
}

/**
 * Crée le fichier de clé avec le keytool du JDK. keytool demande lui-même le mot
 * de passe et le nom dans le terminal : le script n'en passe ni n'en lit aucun.
 * Une clé existante n'est jamais écrasée.
 */
function creerCle(cle) {
  if (existsSync(cle)) {
    arreter(`Un fichier de clé existe déjà : ${cle}\nIl n’est pas remplacé.`);
  }
  const jdk = jdkOuArret();
  mkdirSync(path.dirname(cle), { recursive: true });
  const keytool = path.join(jdk.home, 'bin', WINDOWS ? 'keytool.exe' : 'keytool');
  const args = [
    '-genkeypair', '-v', '-keystore', cle, '-alias', ALIAS,
    '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
  ];
  const resultat = spawnSync(keytool, args, { stdio: 'inherit' });
  if (resultat.status !== 0 || !existsSync(cle)) arreter('La création de la clé a échoué.');
  console.log(
    `\nClé créée : ${cle}\n` +
      'Garde son mot de passe et une copie de ce fichier en lieu sûr. ' +
      'Sans eux, aucune mise à jour ne pourra plus s’installer par-dessus l’application.',
  );
}

const debug = process.argv.includes('--debug');
const cle = path.resolve(process.env['JOLISMOTS_KEYSTORE'] || CLE_PAR_DEFAUT);

if (process.argv.includes('--creer-cle')) {
  creerCle(cle);
  process.exit(0);
}

if (!estDossier(PROJET)) {
  arreter('Lancer d’abord `npx cap add android` depuis `apps/android`.');
}

// La clé est cherchée avant la construction : inutile de compiler pour rien.
if (!debug && !existsSync(cle)) {
  arreter(`Fichier de clé introuvable : ${cle}\n\nPour le créer : npm run cle:android\n`);
}

const jdk = jdkOuArret();

const androidHome = process.env['ANDROID_HOME'];
if (androidHome && !estDossier(androidHome)) {
  arreter(`ANDROID_HOME mène à un dossier qui n’existe pas : ${androidHome}`);
}
const sdk = androidHome ?? (estDossier('C:\\Android\\Sdk') ? 'C:\\Android\\Sdk' : undefined);
if (!sdk) {
  arreter('ANDROID_HOME n’est pas défini et aucun SDK dans C:\\Android\\Sdk');
}

let buildTools = null;
if (!debug) {
  buildTools = trouverBuildTools(sdk);
  if (!buildTools) arreter(`Aucun dossier build-tools dans ${sdk}`);
  console.log(`build-tools : ${buildTools}`);
}

// Numéro de version écrit dans le projet généré.
const gradleApp = path.join(PROJET, 'app', 'build.gradle');
const code = versionCode(VERSION);
const avant = readFileSync(gradleApp, 'utf8');
const apres = avant
  .replace(/versionCode \d+/, `versionCode ${code}`)
  .replace(/versionName "[^"]*"/, `versionName "${VERSION}"`);
if (!apres.includes(`versionCode ${code}`) || !apres.includes(`versionName "${VERSION}"`)) {
  arreter(`versionCode ou versionName introuvable dans ${gradleApp}`);
}
if (apres !== avant) writeFileSync(gradleApp, apres, 'utf8');
console.log(`version ${VERSION} (code ${code})`);

const env = {
  ...process.env,
  JAVA_HOME: jdk.home,
  ANDROID_HOME: sdk,
  PATH: `${path.join(jdk.home, 'bin')}${path.delimiter}${process.env['PATH'] ?? ''}`,
};

// Chemin absolu : avec shell:true, Windows chercherait « gradlew.bat » dans le PATH et non dans cwd.
const gradlew = path.join(PROJET, WINDOWS ? 'gradlew.bat' : 'gradlew');
const tache = debug ? 'assembleDebug' : 'assembleRelease';
const gradle = lancer(gradlew, [tache, '--no-daemon'], { cwd: PROJET, stdio: 'inherit', env });
if (gradle.status !== 0) process.exit(gradle.status ?? 1);

const sorties = path.join(PROJET, 'app', 'build', 'outputs', 'apk', debug ? 'debug' : 'release');
const construit = path.join(sorties, debug ? 'app-debug.apk' : 'app-release-unsigned.apk');
if (!existsSync(construit)) arreter(`APK introuvable : ${construit}`);

const dossier = path.join(ICI, 'release');
mkdirSync(dossier, { recursive: true });
const destination = path.join(dossier, `Jolis-Mots-${VERSION}${debug ? '-debug' : ''}.apk`);

if (debug) {
  copyFileSync(construit, destination);
} else {
  // zipalign avant apksigner : signer après aligner, sinon la signature v2 serait cassée.
  const aligne = path.join(sorties, 'app-release-aligned.apk');
  const zipalign = lancer(
    path.join(buildTools, WINDOWS ? 'zipalign.exe' : 'zipalign'),
    ['-p', '-f', '4', construit, aligne],
    { stdio: 'inherit', env },
  );
  if (zipalign.status !== 0) arreter('zipalign a échoué.');

  const apksigner = path.join(buildTools, WINDOWS ? 'apksigner.bat' : 'apksigner');
  const motDePasse =
    process.env[VARIABLE_MOT_DE_PASSE] !== undefined ? ['--ks-pass', `env:${VARIABLE_MOT_DE_PASSE}`] : [];
  // Sans signature v4, apksigner ne laisse pas de fichier .idsig à côté de l'APK.
  const signature = lancer(
    apksigner,
    [
      'sign', '--ks', cle, '--ks-key-alias', ALIAS, ...motDePasse,
      '--v4-signing-enabled', 'false', '--out', destination, aligne,
    ],
    { stdio: 'inherit', env },
  );
  if (signature.status !== 0) arreter('La signature a échoué.');

  const verification = lancer(apksigner, ['verify', '--print-certs', destination], {
    encoding: 'utf8',
    env,
  });
  if (verification.status !== 0) {
    process.stderr.write(`${verification.stdout ?? ''}${verification.stderr ?? ''}`);
    arreter('La vérification de la signature a échoué.');
  }
  const empreinte = (verification.stdout ?? '')
    .split(/\r?\n/)
    .find((ligne) => ligne.includes('SHA-256'));
  console.log(`\nSignature vérifiée. ${empreinte?.trim() ?? ''}`);
}

console.log(`\nAPK -> ${path.relative(process.cwd(), destination)}`);
