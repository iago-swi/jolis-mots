import { ecrireFichier, type EtatDepot, type FichierMots, type PontBureau, type RaisonDepot } from '@jolis-mots/core';

const PANNES: readonly RaisonDepot[] = ['sans-reseau', 'refus', 'divergence'];

/**
 * Un pont tout en mémoire, pour le développement dans un navigateur et pour les captures.
 * Il part de `depart`, à la fois liste locale et liste envoyée ; rien n'est écrit nulle part.
 * « &envoi=sans-reseau », « refus » ou « divergence » dans l'adresse fait échouer l'envoi ainsi.
 */
export function creerPontDemo(depart: FichierMots, params: URLSearchParams): PontBureau {
  let locale = ecrireFichier(depart);
  let envoyee = locale;
  const demandee = params.get('envoi') as RaisonDepot | null;
  const panne = demandee !== null && PANNES.includes(demandee) ? demandee : null;
  const etat = (raison: RaisonDepot = 'pret', sauvegarde: string | null = null): EtatDepot => ({
    raison,
    detail: raison === 'pret' ? '' : `Panne simulée par le pont de démonstration (${raison}).`,
    locale,
    envoyee,
    sauvegarde,
  });
  return {
    ouvrir: async () => etat(),
    synchroniser: async () => etat(),
    enregistrer: async (texte) => {
      locale = texte;
      return etat();
    },
    // Comme le vrai dépôt : le fichier est écrit avant l'envoi, qu'il réussisse ou non.
    envoyer: async (texte) => {
      locale = texte;
      if (panne !== null) return etat(panne);
      envoyee = texte;
      return etat();
    },
    reprendre: async () => {
      locale = envoyee;
      return etat('pret', 'mots-demonstration.json');
    },
    ouvrirCnrtl: async (adresse) => {
      window.open(adresse, '_blank', 'noopener');
    },
    signalerFicheModifiee: () => {},
  };
}
