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
import { etat } from './etat.svelte';
import { rafraichir } from './miseAJour';

etat.demarrer(location);
void rafraichir();

// Dans l'application Android seulement : le bouton retour ferme ce qui est ouvert, puis quitte depuis l'écran Mot.
if (Capacitor.isNativePlatform()) {
  void Appareil.addListener('backButton', () => {
    if (!etat.retour()) void Appareil.exitApp();
  });
  // Icônes de la barre d'état lisibles sur la palette affichée. Le style nomme l'interface, pas les icônes :
  // DARK = icônes claires (fond sombre), LIGHT = icônes sombres (fond clair).
  etat.suivreFondSombre((sombre) => {
    void SystemBars.setStyle({ style: sombre ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  });
}

const cible = document.getElementById('app');
if (!cible) throw new Error('#app introuvable');

export default mount(App, { target: cible });
