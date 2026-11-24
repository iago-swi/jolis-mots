import { mount } from 'svelte';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/500-italic.css';
import './app.css';
import App from './App.svelte';
import { etat } from './etat.svelte';

etat.demarrer(location);

const cible = document.getElementById('app');
if (!cible) throw new Error('#app introuvable');

export default mount(App, { target: cible });
