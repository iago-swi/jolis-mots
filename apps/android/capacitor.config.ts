import type { CapacitorConfig } from '@capacitor/cli';

/**
 * L'enveloppe Android.
 *
 * `webDir` pointe sur la construction de `apps/web` : elle embarque déjà la liste
 * des mots, les polices et les styles, et garde le progrès dans localStorage, ce
 * qu'offre la WebView. L'application n'a donc besoin ni de serveur ni de greffon
 * de stockage.
 */
const config: CapacitorConfig = {
  appId: 'ch.noth.jolismots',
  appName: 'Jolis Mots',
  webDir: '../web/dist',
  android: {
    // WebView transparente (#RRGGBBAA) : avant le premier affichage de la page, on voit le fond de la
    // fenêtre (`fond_fenetre`, écrit par make-icons.mjs), papier le jour et Nuit en mode sombre,
    // plutôt qu'un papier clair fixe en mode sombre ou le blanc par défaut de la WebView.
    backgroundColor: '#00000000',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Bord à bord (imposé par Android 16) : la WebView s'étend sous les barres du système et
    // reçoit leurs hauteurs dans --safe-area-inset-* ; app.css en tire --marge-haut et --marge-bas.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
