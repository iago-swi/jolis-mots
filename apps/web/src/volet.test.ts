// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { volet } from './volet';

/** La page : un bouton « ouvreur » qui a le curseur, puis un volet. */
function page(avecDepart: boolean): { ouvreur: HTMLButtonElement; noeud: HTMLElement; depart: HTMLButtonElement | null } {
  const ouvreur = document.createElement('button');
  ouvreur.textContent = 'Ouvrir';
  document.body.append(ouvreur);
  ouvreur.focus();
  const noeud = document.createElement('section');
  const autre = document.createElement('button');
  autre.textContent = 'Autre';
  noeud.append(autre);
  let depart: HTMLButtonElement | null = null;
  if (avecDepart) {
    depart = document.createElement('button');
    depart.textContent = 'Départ';
    depart.dataset.depart = '';
    noeud.append(depart);
  }
  document.body.append(noeud);
  return { ouvreur, noeud, depart };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('volet', () => {
  it('place le curseur sur le départ, ferme sur Échap et rend le curseur à l’ouvreur', () => {
    const { ouvreur, noeud, depart } = page(true);
    expect(document.activeElement).toBe(ouvreur);
    const fermer = vi.fn();
    const action = volet(noeud, { fermer });
    expect(document.activeElement).toBe(depart);
    noeud.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fermer).toHaveBeenCalledTimes(1);
    action.destroy();
    expect(document.activeElement).toBe(ouvreur);
  });

  it('ignore les autres touches', () => {
    const { noeud } = page(true);
    const fermer = vi.fn();
    const action = volet(noeud, { fermer });
    noeud.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(fermer).not.toHaveBeenCalled();
    action.destroy();
  });

  it('Échap ferme même quand le curseur est tombé sur la page, une seule fois ; plus après le retrait', () => {
    const { noeud } = page(true);
    const fermer = vi.fn();
    const action = volet(noeud, { fermer });
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fermer).toHaveBeenCalledTimes(1);
    noeud.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fermer).toHaveBeenCalledTimes(2);
    action.destroy();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fermer).toHaveBeenCalledTimes(2);
  });

  it('le volet reçoit toujours tabindex="-1", même avec un départ', () => {
    const { noeud } = page(true);
    const action = volet(noeud, { fermer: vi.fn() });
    expect(noeud.getAttribute('tabindex')).toBe('-1');
    action.destroy();
  });

  it('sans data-depart, place le curseur sur le volet lui-même', () => {
    const { noeud } = page(false);
    const action = volet(noeud, { fermer: vi.fn() });
    expect(noeud.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(noeud);
    action.destroy();
  });

  it('rend le curseur à l’ouvreur même s’il ne redevient atteignable qu’après le retrait', async () => {
    const { ouvreur, noeud } = page(true);
    const action = volet(noeud, { fermer: vi.fn() });
    // Comme la liste du Recueil, encore inerte au moment où Svelte retire le volet.
    ouvreur.disabled = true;
    action.destroy();
    ouvreur.disabled = false;
    await Promise.resolve();
    expect(document.activeElement).toBe(ouvreur);
  });

  it('ne lève rien si l’ouvreur a quitté la page avant le retrait', () => {
    const { ouvreur, noeud } = page(true);
    const action = volet(noeud, { fermer: vi.fn() });
    ouvreur.remove();
    expect(() => action.destroy()).not.toThrow();
    expect(document.activeElement).not.toBe(ouvreur);
  });
});
