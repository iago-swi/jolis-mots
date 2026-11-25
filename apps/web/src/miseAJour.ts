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

let enCours: Promise<void> | null = null;

/**
 * Demande en arrière-plan la dernière liste en ligne. Sans réseau, en cas d'erreur
 * ou de réponse inutilisable, ne fait rien et ne signale rien : ne lève jamais d'exception.
 */
export function rafraichir(): Promise<void> {
  // Une seule demande à la fois : le démarrage et le retour dans l'application peuvent se suivre de près.
  enCours ??= demander(ADRESSE_LISTE)
    .then((recue) => {
      // Silence voulu : l'application a déjà sa liste.
      if (recue !== undefined) etat.proposerListe(recue);
    })
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

export type ResultatVerification = 'nouvelle' | 'a-jour' | 'hors-ligne';

/**
 * « Vérifier maintenant » (conception, section 17) : la liste demandée à l'API de GitHub, dont le cache
 * est plus court, sinon à l'adresse habituelle ; adoptée tout de suite, sans attendre le mot suivant.
 * Rend « nouvelle » quand l'historique a gagné une entrée. Ne lève jamais d'exception.
 */
export async function verifierMaintenant(): Promise<ResultatVerification> {
  let recue = await demander(ADRESSE_LISTE_API, { Accept: 'application/vnd.github.raw' });
  // L'API a pu répondre autre chose que la liste (une erreur en JSON, un autre format) : l'adresse habituelle.
  if (validerFichier(recue) === null) recue = await demander(ADRESSE_LISTE);
  if (recue === undefined) return 'hors-ligne';
  const avant = etat.historique[etat.historique.length - 1];
  etat.proposerListe(recue);
  etat.adopterListeEnAttente();
  return etat.historique[etat.historique.length - 1] !== avant ? 'nouvelle' : 'a-jour';
}

/**
 * Redemande la liste chaque fois que l'application redevient visible : Android la met en pause plutôt
 * que de la fermer, et elle ne démarre alors pas de nouveau. La liste reçue attend le mot suivant.
 */
export function rafraichirAuRetour(page: Pick<Document, 'visibilityState' | 'addEventListener'>): void {
  page.addEventListener('visibilitychange', () => {
    if (page.visibilityState === 'visible') void rafraichir();
  });
}
