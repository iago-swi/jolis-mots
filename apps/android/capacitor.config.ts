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
    // Le papier de la palette par défaut : pas d'éclair blanc avant le premier affichage.
    backgroundColor: '#F3F4EF',
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
