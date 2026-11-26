import { ADRESSE_LISTE, ADRESSE_LISTE_API, validerFichier } from '@jolis-mots/core';
import { etat } from './etat.svelte';

const DELAI_MS = 8000;

/** Le contenu JSON de `adresse`, ou undefined sans réseau, en cas d'erreur ou de réponse illisible. */
async function demander(adresse: string, entetes?: Record<string, string>): Promise<unknown> {
  const abandon = new AbortController();
  const minuterie = setTimeout(() => abandon.abort(), DELAI_MS);
  try {
    const reponse = await fetch(adresse, { cache: 'no-store', signal: abandon.signal, headers: entetes });
    if (!reponse.ok) return undefined;
    return (await reponse.json()) as unknown;
  } catch {
    return undefined;
  } finally {
    clearTimeout(minuterie);
  }
}

export type ResultatVerification = 'nouvelle' | 'a-jour' | 'hors-ligne';

/**
 * La liste demandée à l'API de GitHub, dont le cache est plus court, sinon à l'adresse habituelle ;
 * adoptée tout de suite. « nouvelle » quand l'historique a gagné une entrée. Ne lève jamais d'exception.
 */
async function chercher(): Promise<ResultatVerification> {
  let recue = await demander(ADRESSE_LISTE_API, { Accept: 'application/vnd.github.raw' });
  // L'API a pu répondre autre chose que la liste (une erreur en JSON, un autre format) : l'adresse habituelle.
  if (validerFichier(recue) === null) recue = await demander(ADRESSE_LISTE);
  // Rien d'utilisable des deux côtés : comme sans réseau, pas « à jour ».
  if (validerFichier(recue) === null) return 'hors-ligne';
  const avant = etat.historique[etat.historique.length - 1];
  etat.recevoirListe(recue);
  return etat.historique[etat.historique.length - 1] !== avant ? 'nouvelle' : 'a-jour';
}

let enCours: Promise<ResultatVerification> | null = null;

/**
 * La vérification de la liste en ligne, au lancement et par « Vérifier maintenant » (conception, section 19).
 * Le résultat est dit par la bulle ; au lancement, sans réseau, rien n'est dit. Une seule demande à la fois :
 * le bouton touché pendant celle du lancement attend la même réponse, et dit son résultat.
 */
export async function verifier(auLancement = false): Promise<ResultatVerification> {
  enCours ??= chercher().finally(() => {
    enCours = null;
  });
  const r = await enCours;
  // « nouvelle » : `etat.noterListe` a déjà posé l'annonce, avec son bilan.
  if (r === 'a-jour') etat.annoncer({ sorte: 'a-jour' }, auLancement);
  if (r === 'hors-ligne' && !auLancement) etat.annoncer({ sorte: 'hors-ligne' });
  return r;
}
