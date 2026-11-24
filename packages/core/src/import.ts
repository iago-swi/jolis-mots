import { comparerMots } from './fichier';
import { genreEstConnu } from './genre';
import { normaliser } from './recherche';
import { estComplet, type FichierMots, type Mot } from './types';

/** Une ligne de la feuille « Philippe », chaque cellule en texte. */
export interface LigneExcel { mot: string; tri: string; genre: string; definition: string; note: string; util: string; source: string; rouge: boolean }

export interface RapportImport {
  lignes: number; mots: number; complets: number; aCompleter: number;
  doublonsFusionnes: string[];   // mots dont des lignes vides ont été écartées
  doublonsGardes: string[];      // mots présents plusieurs fois après import
  lignesRouges: string[];
  aCompleterAvecTexte: string[]; // marqués « à compléter » avec du texte en définition
  genresInhabituels: string[];   // "Mot : genre"
}

type Fiche = Omit<Mot, 'id'>;

const DIESES = /#{3,}/g;

/** Clé de doublon : le mot sans majuscules, accents ni espaces en trop. */
function cleDoublon(mot: string): string {
  return normaliser(mot).replace(/\s+/g, ' ').trim();
}

function lireSources(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== '' && s !== '-');
}

function convertir(l: LigneExcel): Fiche {
  const diese = l.genre.includes('###') || l.definition.includes('###');
  const definition = l.definition.replace(DIESES, '').trim();
  return {
    mot: l.mot.trim(),
    tri: l.tri.trim(),
    genre: l.genre.replace(DIESES, '').trim(),
    definition,
    sources: lireSources(l.source),
    note: l.note.trim(),
    util: l.util.trim(),
    aCompleter: diese || definition === '',
  };
}

/** Importe les lignes de l'Excel : nettoyage, dièses, doublons, identifiants, ordre de Tri. */
export function importer(
  lignes: LigneExcel[],
  options: { publie: string; creerId: () => string; existant?: FichierMots },
): { fichier: FichierMots; rapport: RapportImport } {
  const fiches = lignes.map(convertir);

  // Lignes non rouges regroupées par mot, dans l'ordre de première apparition.
  const groupes = new Map<string, Fiche[]>();
  fiches.forEach((f, i) => {
    if (lignes[i]!.rouge) return;
    const cle = cleDoublon(f.mot);
    groupes.set(cle, [...(groupes.get(cle) ?? []), f]);
  });

  const doublonsFusionnes: string[] = [];
  const doublonsGardes: string[] = [];
  const ecartees = new Set<Fiche>();
  for (const groupe of groupes.values()) {
    if (groupe.length === 1) continue;
    const avecDefinition = groupe.filter((f) => f.definition !== '');
    if (avecDefinition.length > 1) {
      doublonsGardes.push(groupe[0]!.mot);
      continue;
    }
    const gardee = avecDefinition[0] ?? groupe[0]!;
    gardee.sources = [...new Set(groupe.flatMap((f) => f.sources))];
    groupe.filter((f) => f !== gardee).forEach((f) => ecartees.add(f));
    doublonsFusionnes.push(gardee.mot);
  }
  const retenues = fiches.filter((f) => !ecartees.has(f));

  // Un mot retrouvé avec les mêmes Mot et Tri reprend son identifiant.
  const cle = (m: { mot: string; tri: string }) => `${m.mot}\u0000${m.tri}`;
  const anciens = new Map<string, string[]>();
  for (const m of options.existant?.mots ?? []) anciens.set(cle(m), [...(anciens.get(cle(m)) ?? []), m.id]);
  const ids = retenues.map((f) => anciens.get(cle(f))?.shift());
  const pris = new Set<string>([...(options.existant?.mots ?? []).map((m) => m.id)]);
  const mots: Mot[] = retenues.map((f, i) => {
    let id = ids[i];
    while (id === undefined || (ids[i] === undefined && pris.has(id))) id = options.creerId();
    pris.add(id);
    return { id, ...f };
  });
  mots.sort(comparerMots);

  const complets = mots.filter(estComplet).length;
  const rapport: RapportImport = {
    lignes: lignes.length,
    mots: mots.length,
    complets,
    aCompleter: mots.length - complets,
    doublonsFusionnes,
    doublonsGardes,
    lignesRouges: fiches.filter((_, i) => lignes[i]!.rouge).map((f) => f.mot),
    aCompleterAvecTexte: mots.filter((m) => m.aCompleter && m.definition !== '').map((m) => m.mot),
    genresInhabituels: mots.filter((m) => !genreEstConnu(m.genre)).map((m) => `${m.mot} : ${m.genre}`),
  };
  return { fichier: { format: 1, publie: options.publie, mots }, rapport };
}

function section(titre: string, explication: string, liste: string[]): string {
  const corps = liste.length === 0 ? 'aucun' : liste.map((e) => `- ${e}`).join('\n');
  return `## ${titre} (${liste.length})\n\n${explication}\n\n${corps}\n`;
}

/** Rapport d'import lisible par Philippe. */
export function rapportEnMarkdown(r: RapportImport): string {
  return [
    "# Rapport d'import\n",
    `- Lignes lues : ${r.lignes}`,
    `- Mots importés : ${r.mots}`,
    `- Mots complets : ${r.complets}`,
    `- Mots à compléter : ${r.aCompleter}\n`,
    section('Doublons fusionnés', 'Une seule fiche gardée ; les lignes vides ont été écartées, leurs sources réunies.', r.doublonsFusionnes),
    section('Doublons gardés', 'Plusieurs lignes ont une définition : toutes sont gardées.', r.doublonsGardes),
    section('Lignes rouges', 'Importées telles quelles, à départager dans l’atelier.', r.lignesRouges),
    section('À compléter avec du texte en définition', 'Marqués ### mais la définition contient déjà du texte.', r.aCompleterAvecTexte),
    section('Genres inhabituels', 'Un terme du genre est inconnu de la table de développement.', r.genresInhabituels),
  ].join('\n');
}
