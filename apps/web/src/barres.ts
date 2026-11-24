/**
 * La WebView est-elle bord à bord sous les barres du système ?
 *
 * Capacitor (SystemBars.java) ne la met bord à bord qu'à partir de Chromium 140,
 * avec `viewport-fit=cover`. Avant, il la décale sous les barres : celles-ci sont
 * alors posées sur le fond de la fenêtre Android, qui suit le mode de l'appareil,
 * pas la palette de l'application.
 */
export function webViewBordABord(userAgent: string): boolean {
  const version = /Chrome\/(\d+)/.exec(userAgent);
  return version === null || Number(version[1]) >= 140;
}
