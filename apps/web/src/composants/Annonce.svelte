<script lang="ts">
  import type { EntreeHistorique } from '@jolis-mots/core';
  import { etat } from '../etat.svelte';

  /** Le temps que l'annonce reste à l'écran. */
  const DUREE = 6000;

  /** « 1 139 mots », avec une espace fine insécable entre les milliers. */
  function nombre(n: number): string {
    return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${n > 1 ? 'mots' : 'mot'}`;
  }

  /** « +2 · ~1 · −1 » : les sortes absentes ne sont pas dites, comme dans l'historique. */
  function bilan(e: EntreeHistorique): string {
    const parties: string[] = [];
    if (e.ajoutes.length > 0) parties.push(`+${e.ajoutes.length}`);
    if (e.modifies.length > 0) parties.push(`~${e.modifies.length}`);
    if (e.supprimes.length > 0) parties.push(`−${e.supprimes.length}`);
    return parties.join(' · ');
  }

  /** La même chose en toutes lettres, pour les lecteurs d'écran. */
  function bilanDit(e: EntreeHistorique): string {
    const parties: string[] = [];
    const dire = (n: number, s: string, p: string) => {
      if (n > 0) parties.push(`${n} ${n > 1 ? p : s}`);
    };
    dire(e.ajoutes.length, 'mot ajouté', 'mots ajoutés');
    dire(e.modifies.length, 'mot modifié', 'mots modifiés');
    dire(e.supprimes.length, 'mot supprimé', 'mots supprimés');
    return `Liste mise à jour : ${parties.join(', ')} ; ${nombre(e.total)}.`;
  }

  /** Seulement sur l'écran Mot : ailleurs, elle cacherait le haut de l'écran (recherche, question du quiz). */
  const visible = $derived(etat.annonce !== null && etat.ecran === 'mot');

  // Chaque nouvelle annonce repart pour six secondes.
  $effect(() => {
    if (etat.annonce === null) return;
    const minuterie = setTimeout(() => etat.fermerAnnonce(), DUREE);
    return () => clearTimeout(minuterie);
  });
</script>

<!-- La phrase en toutes lettres est dite par la zone d'état, toujours présente ; le bouton, lui, mène à l'historique. -->
<span class="visuel-cache" role="status">{visible && etat.annonce !== null ? bilanDit(etat.annonce) : ''}</span>
<div class="zone">
  {#if visible && etat.annonce !== null}
    <button class="annonce" aria-label="Voir l’historique de la liste" onclick={() => etat.ouvrirAnnonce()}>
      Liste mise à jour · {bilan(etat.annonce)} <span aria-hidden="true">→</span> {nombre(etat.annonce.total)}
    </button>
  {/if}
</div>

<style>
  /* Sous l'en-tête, au-dessus de l'écran, sans rien pousser ni cacher les boutons du bas. */
  .zone {
    position: absolute;
    top: 6px;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    justify-content: center;
    padding: 0 16px;
    pointer-events: none;
  }

  .annonce {
    pointer-events: auto;
    max-width: 100%;
    min-height: 36px;
    padding: 6px 16px;
    border: 1px solid var(--filet);
    border-radius: 18px;
    background: var(--papier);
    color: var(--second);
    font: inherit;
    font-size: 15px;
    cursor: pointer;
  }

  .visuel-cache {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: no-preference) {
    .annonce {
      animation: apparaitre 0.25s ease-out;
    }
  }

  @keyframes apparaitre {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
  }
</style>
