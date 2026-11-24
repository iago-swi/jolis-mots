import { ecrireFichier, type EtatDepot, type FichierMots, type PontBureau, type RaisonDepot } from '@jolis-mots/core';

const PANNES: readonly RaisonDepot[] = ['sans-reseau', 'refus', 'divergence'];

/**
 * Un pont tout en mémoire, pour le développement dans un navigateur et pour les captures.
 * Il part de `depart`, à la fois liste locale et liste envoyée ; rien n'est écrit nulle part.
 * « &envoi=sans-reseau », « refus » ou « divergence » dans l'adresse fait échouer l'envoi ainsi.
 * « &copie=aucune » part sans copie (la première synchronisation échoue faute de réseau, la suivante
 * la reçoit) ; « &copie=illisible » part d'une copie dont le fichier des mots ne se lit pas.
 */
export function creerPontDemo(depart: FichierMots, params: URLSearchParams): PontBureau {
  const copie = params.get('copie');
  let envoyee: string | null = copie === 'aucune' ? null : ecrireFichier(depart);
  let locale: string | null = copie === 'illisible' ? '{"format":1,"publie":' : envoyee;
  let synchronisations = 0;
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
    synchroniser: async () => {
      if (envoyee === null) {
        if (synchronisations++ === 0) return etat('sans-reseau');
        locale = envoyee = ecrireFichier(depart);
      }
      return etat();
    },
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
