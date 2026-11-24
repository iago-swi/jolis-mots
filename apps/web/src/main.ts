import { App as Appareil } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { mount } from 'svelte';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/500-italic.css';
import './app.css';
import App from './App.svelte';
import { atelier } from './atelier.svelte';
import { webViewBordABord } from './barres';
import { etat } from './etat.svelte';
import { rafraichir } from './miseAJour';

/** Sur bureau, l'attente de la liste locale avant le premier mot ; au-delà, la lecture part sur la liste embarquée. */
const DELAI_LISTE_LOCALE_MS = 3000;

function lancer(): void {
  etat.demarrer(location);
  // La palette avant le premier affichage : App.svelte ne la pose qu'une fois monté.
  document.documentElement.dataset.palette = etat.paletteAffichee;
  // Sur le téléphone : la liste en ligne. Sur bureau, c'est l'atelier qui la reçoit, par git.
  if (atelier === null) void rafraichir();

  // Dans l'application Android seulement : le bouton retour ferme ce qui est ouvert, puis quitte depuis l'écran Mot.
  if (Capacitor.isNativePlatform()) {
    void Appareil.addListener('backButton', () => {
      if (!etat.retour()) void Appareil.exitApp();
    });
    // Icônes des barres du système lisibles sur le fond qui est dessous. Le style nomme l'interface, pas les icônes :
    // DARK = icônes claires (fond sombre), LIGHT = icônes sombres (fond clair).
    etat.suivreFondDesBarres(webViewBordABord(navigator.userAgent), (sombre) => {
      void SystemBars.setStyle({ style: sombre ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
    });
  }

  const cible = document.getElementById('app');
  if (!cible) throw new Error('#app introuvable');
  mount(App, { target: cible });
}

if (atelier === null) {
  lancer();
} else {
  // La liste locale d'abord ; la synchronisation avec la liste en ligne finit seule, en arrière-plan.
  const delai = new Promise<void>((fin) => setTimeout(fin, DELAI_LISTE_LOCALE_MS));
  void Promise.race([atelier.demarrer().catch(() => undefined), delai]).then(lancer);
}
