/**
 * Fabrique l'APK Android.
 *
 * Sert surtout à trouver le bon JDK. Gradle refuse de démarrer sur une JVM plus
 * récente que celles qu'il connaît : sur cette machine, le Java du système est
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
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(path.join(ICI, '..', '..', 'package.json'), 'utf8')).version;
const PROJET = path.join(ICI, 'android');

/** Gradle 8.14 accepte Java jusqu'au 24 ; le greffon Android demande au moins le 17. */
const JAVA_MIN = 17;
const JAVA_MAX = 24;

const RACINES_JDK = [
  'C:\\Program Files\\Eclipse Adoptium',
  'C:\\Program Files\\Java',
  'C:\\Program Files\\Microsoft',
  '/usr/lib/jvm',
];

function versionCode(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`version illisible : ${version}`);
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

function majeureJava(home) {
  const bin = path.join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
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

const jdk = trouverJdk();
if (!jdk) {
  console.error(
    `Aucun JDK entre ${JAVA_MIN} et ${JAVA_MAX}, et Gradle ne démarre sur rien de plus récent.\n\n` +
      `  winget install EclipseAdoptium.Temurin.21.JDK\n`,
  );
  process.exit(1);
}
console.log(`JDK ${jdk.version} : ${jdk.home}`);

const sdk =
  process.env['ANDROID_HOME'] ??
  (existsSync('C:\\Android\\Sdk') ? 'C:\\Android\\Sdk' : undefined);
if (!sdk) {
  console.error('ANDROID_HOME n’est pas défini et aucun SDK dans C:\\Android\\Sdk');
  process.exit(1);
}

// Numéro de version écrit dans le projet généré.
const gradleApp = path.join(PROJET, 'app', 'build.gradle');
const code = versionCode(VERSION);
const avant = readFileSync(gradleApp, 'utf8');
const apres = avant
  .replace(/versionCode \d+/, `versionCode ${code}`)
  .replace(/versionName "[^"]*"/, `versionName "${VERSION}"`);
if (!apres.includes(`versionCode ${code}`) || !apres.includes(`versionName "${VERSION}"`)) {
  console.error(`versionCode ou versionName introuvable dans ${gradleApp}`);
  process.exit(1);
}
if (apres !== avant) writeFileSync(gradleApp, apres, 'utf8');
console.log(`version ${VERSION} (code ${code})`);

const release = process.argv.includes('--release');
const tache = release ? 'assembleRelease' : 'assembleDebug';

// Chemin absolu : avec shell:true, Windows chercherait « gradlew.bat » dans le PATH et non dans cwd.
const gradlew = path.join(PROJET, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const options = {
  cwd: PROJET,
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME: jdk.home, ANDROID_HOME: sdk },
};

// Windows a besoin d'un shell pour un .bat, et le shell coupe le chemin à ses espaces :
// une seule commande entièrement entre guillemets règle les deux.
const resultat =
  process.platform === 'win32'
    ? spawnSync(`"${gradlew}" ${tache} --no-daemon`, { ...options, shell: true })
    : spawnSync(gradlew, [tache, '--no-daemon'], options);

if (resultat.status !== 0) process.exit(resultat.status ?? 1);

// L'APK sort de l'arborescence de Gradle sous un nom qui dit ce qu'il est.
const construit = path.join(
  PROJET,
  'app', 'build', 'outputs', 'apk',
  release ? 'release' : 'debug',
  release ? 'app-release-unsigned.apk' : 'app-debug.apk',
);
if (!existsSync(construit)) {
  console.error(`APK introuvable : ${construit}`);
  process.exit(1);
}
const dossier = path.join(ICI, 'release');
mkdirSync(dossier, { recursive: true });
const destination = path.join(dossier, `Jolis-Mots-${VERSION}${release ? '-unsigned' : ''}.apk`);
copyFileSync(construit, destination);
console.log(`\nAPK -> ${path.relative(process.cwd(), destination)}`);
