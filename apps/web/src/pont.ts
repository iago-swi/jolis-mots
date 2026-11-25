import type { PontBureau } from '@jolis-mots/core';
import { listeEmbarquee } from './liste-embarquee';
import { creerPontDemo } from './pont-demo';

declare global {
  interface Window {
    /** Posé par Electron : l'application est sur bureau. */
    jolisMots?: PontBureau;
  }
}

function trouverPont(): PontBureau | null {
  if (typeof window === 'undefined') return null;
  if (window.jolisMots) return window.jolisMots;
  const params = new URLSearchParams(window.location.search);
  return params.get('pont') === 'demo' ? creerPontDemo(listeEmbarquee, params) : null;
}

/** Le pont d'Electron ; sinon, avec « ?pont=demo » dans l'adresse, le pont de démonstration ; sinon null (téléphone). */
export const pont: PontBureau | null = trouverPont();
