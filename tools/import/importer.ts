// Import de l'Excel vers donnees/mots.json. Lancé par `npm run import -- --ecraser`, depuis la racine du projet.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { creerId, ecrireFichier, importer, lireDefinition, rapportEnMarkdown, validerFichier, type LigneExcel } from '@jolis-mots/core';

// Garde : depuis l'atelier, mots.json est retouché dans l'application ; un import le remplacerait.
if (!process.argv.slice(2).includes('--ecraser')) {
  console.error(
    "L'atelier est désormais la source des mots : relancer l'import écraserait son travail. Pour le faire quand même : npm run import -- --ecraser",
  );
  process.exit(1);
}

const LIGNES = 'tools/import/sortie/lignes.json';
const RAPPORT = 'tools/import/sortie/rapport-import.md';
const DONNEES = 'donnees';
const MOTS = `${DONNEES}/mots.json`;

if (!existsSync(DONNEES)) {
  console.error(`Le dossier « ${DONNEES}/ » n'existe pas. Montez la branche des données :\n  git worktree add donnees donnees`);
  process.exit(1);
}

const lignes = JSON.parse(readFileSync(LIGNES, 'utf8')) as LigneExcel[];

let existant;
if (existsSync(MOTS)) {
  existant = validerFichier(JSON.parse(readFileSync(MOTS, 'utf8')));
  if (existant === null) {
    console.error(`« ${MOTS} » n'a pas la forme attendue : import arrêté pour ne pas perdre les identifiants.`);
    process.exit(1);
  }
}

const { fichier, rapport } = importer(lignes, { publie: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), creerId, existant });

// Même contrôle que le test « ne perd aucun mot » de lireDefinition, sur les définitions réelles.
const motsDe = (t: string) => t.replace(/\b(EX|SYN|US|ANTON|ANT) ?:/g, ' ').match(/[\p{L}\p{N}]+/gu) ?? [];
const perdus = fichier.mots.filter((m) => {
  const sortie = lireDefinition(m.definition)
    .map((s) => [s.numero, s.indication, s.texte, ...s.exemples, ...s.synonymes, ...s.antonymes, ...s.usages].join(' '))
    .join(' ');
  return motsDe(m.definition).some((mot) => !sortie.includes(mot));
});

writeFileSync(MOTS, ecrireFichier(fichier), 'utf8');
mkdirSync('tools/import/sortie', { recursive: true });
const controle = `## Définitions dont la lecture perd un mot (${perdus.length})\n\n${perdus.length === 0 ? 'aucune' : perdus.map((m) => `- ${m.mot}`).join('\n')}\n`;
writeFileSync(RAPPORT, rapportEnMarkdown(rapport) + '\n' + controle, 'utf8');

console.log(`${rapport.lignes} lignes lues, ${rapport.mots} mots, ${rapport.complets} complets, ${rapport.lignesRouges.length} lignes rouges, ${perdus.length} définition(s) avec mot perdu.`);
console.log(`Écrit : ${MOTS} et ${RAPPORT}`);
