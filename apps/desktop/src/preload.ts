// Le pont vers l'atelier, posé dans la page sous `window.jolisMots`. Le preload tourne
// isolé (sandbox) : il ne connaît que `contextBridge` et `ipcRenderer`, et ne fait que
// passer chaque demande au processus principal.

import { contextBridge, ipcRenderer } from 'electron';
import type { EtatDepot, PontBureau } from '@jolis-mots/core';

const pont: PontBureau = {
  ouvrir: (): Promise<EtatDepot> => ipcRenderer.invoke('depot:ouvrir'),
  synchroniser: (): Promise<EtatDepot> => ipcRenderer.invoke('depot:synchroniser'),
  enregistrer: (texte: string): Promise<EtatDepot> => ipcRenderer.invoke('depot:enregistrer', texte),
  envoyer: (texte: string, message: string): Promise<EtatDepot> => ipcRenderer.invoke('depot:envoyer', texte, message),
  reprendre: (): Promise<EtatDepot> => ipcRenderer.invoke('depot:reprendre'),
  ouvrirCnrtl: async (adresse: string): Promise<void> => {
    await ipcRenderer.invoke('cnrtl:ouvrir', adresse);
  },
  signalerFicheModifiee: (modifiee: boolean): void => ipcRenderer.send('fiche:modifiee', modifiee),
};

contextBridge.exposeInMainWorld('jolisMots', pont);
