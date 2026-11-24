/**
 * Action Svelte pour un volet ou une confirmation, utilisable au clavier.
 *
 * À la pose, retient l'élément qui avait le curseur et place le curseur sur le premier
 * descendant marqué `data-depart`, sinon sur le volet lui-même. La touche Échap appelle
 * `fermer`. Au retrait, quelle qu'en soit la cause (bouton, Échap, retour d'Android),
 * le curseur revient à l'élément retenu s'il est encore dans la page.
 */
export function volet(noeud: HTMLElement, options: { fermer: () => void }): { destroy(): void } {
  const ouvreur = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const depart = noeud.querySelector<HTMLElement>('[data-depart]');
  if (depart !== null) {
    depart.focus({ preventScroll: true });
  } else {
    if (!noeud.hasAttribute('tabindex')) noeud.setAttribute('tabindex', '-1');
    noeud.focus({ preventScroll: true });
  }

  function touche(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    options.fermer();
  }
  noeud.addEventListener('keydown', touche);

  return {
    destroy(): void {
      noeud.removeEventListener('keydown', touche);
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
