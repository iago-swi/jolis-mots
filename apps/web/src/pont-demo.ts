import { ecrireFichier, type EtatDepot, type FichierMots, type PontBureau, type RaisonDepot } from '@jolis-mots/core';

const PANNES: readonly RaisonDepot[] = ['sans-reseau', 'refus', 'divergence'];

/** Un message de git de plusieurs lignes, comme en rend un envoi refusé (« &detail=long »). */
const DETAIL_LONG = [
  'To https://github.com/iago-swi/jolis-mots.git',
  ' ! [rejected]        donnees -> donnees (fetch first)',
  "error: failed to push some refs to 'https://github.com/iago-swi/jolis-mots.git'",
  'hint: Updates were rejected because the remote contains work that you do not',
  'hint: have locally. This is usually caused by another repository pushing to',
  'hint: the same ref. If you want to integrate the remote changes, use',
  "hint: 'git pull' before pushing again.",
].join('\n');

/**
 * Un pont tout en mémoire, pour le développement dans un navigateur et pour les captures.
 * Il part de `depart`, à la fois liste locale et liste envoyée ; rien n'est écrit nulle part.
 * « &envoi=sans-reseau », « refus » ou « divergence » dans l'adresse fait échouer l'envoi ainsi.
 * « &copie=aucune » part sans copie (la première synchronisation échoue faute de réseau, la suivante
 * la reçoit) ; « &copie=illisible » part d'une copie dont le fichier des mots ne se lit pas.
 * « &detail=long » donne aux pannes un message de git de sept lignes ; « &reprise=echec » fait
 * échouer la reprise, faute de réseau ; « &sync=sans-reseau » fait échouer toute synchronisation
 * faute de réseau, la copie étant là (l'atelier travaille alors sans rien dire).
 */
export function creerPontDemo(depart: FichierMots, params: URLSearchParams): PontBureau {
  const copie = params.get('copie');
  let envoyee: string | null = copie === 'aucune' ? null : ecrireFichier(depart);
  let locale: string | null = copie === 'illisible' ? '{"format":1,"publie":' : envoyee;
  let synchronisations = 0;
  const demandee = params.get('envoi') as RaisonDepot | null;
  const panne = demandee !== null && PANNES.includes(demandee) ? demandee : null;
  const panneDite = (raison: RaisonDepot) =>
    params.get('detail') === 'long' ? DETAIL_LONG : `Panne simulée par le pont de démonstration (${raison}).`;
  const etat = (raison: RaisonDepot = 'pret', sauvegarde: string | null = null): EtatDepot => ({
    raison,
    detail: raison === 'pret' ? '' : panneDite(raison),
    locale,
    envoyee,
    sauvegarde,
  });
  return {
    ouvrir: async () => etat(),
    synchroniser: async () => {
      if (params.get('sync') === 'sans-reseau' && locale !== null) return etat('sans-reseau');
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
      if (params.get('reprise') === 'echec') return etat('sans-reseau');
      locale = envoyee;
      // Un chemin avec une apostrophe : il doit s'afficher tel quel.
      return etat('pret', "C:\\Users\\O'Brien\\AppData\\Roaming\\Jolis Mots\\sauvegardes\\mots-2026-11-24-153012.json");
    },
    ouvrirCnrtl: async (adresse) => {
      window.open(adresse, '_blank', 'noopener');
    },
    signalerFicheModifiee: () => {},
  };
}
