import { ADRESSE_LISTE } from '@jolis-mots/core';
import { etat } from './etat.svelte';

const DELAI_MS = 8000;

/**
 * Demande en arrière-plan la dernière liste en ligne. Sans réseau, en cas d'erreur
 * ou de réponse inutilisable, ne fait rien et ne signale rien : ne lève jamais d'exception.
 */
export async function rafraichir(): Promise<void> {
  const abandon = new AbortController();
  const minuterie = setTimeout(() => abandon.abort(), DELAI_MS);
  try {
    const reponse = await fetch(ADRESSE_LISTE, { cache: 'no-store', signal: abandon.signal });
    if (!reponse.ok) return;
    etat.proposerListe(await reponse.json());
  } catch {
    // Silence voulu : l'application a déjà sa liste.
  } finally {
    clearTimeout(minuterie);
  }
}
