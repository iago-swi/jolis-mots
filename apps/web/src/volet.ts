/**
 * Action Svelte pour un volet ou une confirmation, utilisable au clavier.
 *
 * À la pose, retient l'élément qui avait le curseur et place le curseur sur le premier
 * descendant marqué `data-depart`, sinon sur le volet lui-même (qui reçoit toujours
 * `tabindex="-1"`). Tant que le volet est posé, la touche Échap appelle `fermer`, où que soit
 * le curseur, même retombé sur la page. Au retrait, quelle qu'en soit la cause (bouton, Échap, retour d'Android),
 * le curseur revient à l'élément retenu s'il est encore dans la page.
 */
export function volet(noeud: HTMLElement, options: { fermer: () => void }): { destroy(): void } {
  const ouvreur = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  noeud.setAttribute('tabindex', '-1');
  const depart = noeud.querySelector<HTMLElement>('[data-depart]');
  (depart ?? noeud).focus({ preventScroll: true });

  function touche(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    options.fermer();
  }
  document.addEventListener('keydown', touche);

  return {
    destroy(): void {
      document.removeEventListener('keydown', touche);
      if (ouvreur === null) return;
      const rendre = (): void => {
        if (ouvreur.isConnected) ouvreur.focus({ preventScroll: true });
      };
      rendre();
      // L'ouvreur peut être encore inerte à cet instant (la page sous le volet ne le redevient
      // qu'à la fin de la mise à jour) : on réessaie juste après.
      if (document.activeElement !== ouvreur) queueMicrotask(rendre);
    },
  };
}
