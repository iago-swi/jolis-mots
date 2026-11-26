<script lang="ts">
  import { annonce, annonceDite } from '../bilan';
  import { etat } from '../etat.svelte';
  import Pastille from './Pastille.svelte';

  /** Le temps que l'annonce reste à l'écran. */
  const DUREE = 6000;

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
<span class="visuel-cache" role="status">{visible && etat.annonce !== null ? annonceDite(etat.annonce) : ''}</span>
<div class="zone">
  {#if visible && etat.annonce !== null}
    <Pastille etiquette="Voir l’historique de la liste" onclick={() => etat.ouvrirAnnonce()}>{annonce(etat.annonce)}</Pastille>
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

  .visuel-cache {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
