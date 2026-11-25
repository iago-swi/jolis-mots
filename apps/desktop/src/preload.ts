// Le pont vers l'atelier, posé dans la page sous `window.jolisMots`. Le preload tourne
// isolé (sandbox) : il ne fait que passer chaque demande au processus principal. Les mots
// inconnus aussi : `webFrame.isWordMisspelled`, permis ici, rend toujours faux sous Windows,
// où le correcteur du système souligne (voir `orthographe.ts`).

import { contextBridge, ipcRenderer } from 'electron';
import type { EntreeHistorique, EtatDepot, PontBureau } from '@jolis-mots/core';

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
  motsInconnus: (mots: string[]): Promise<string[]> => ipcRenderer.invoke('orthographe:inconnus', mots),
  historique: (): Promise<EntreeHistorique[] | null> => ipcRenderer.invoke('depot:historique'),
};

contextBridge.exposeInMainWorld('jolisMots', pont);
