<script lang="ts">
  import { annonceDite, texteAnnonce } from '../bilan';
  import { etat } from '../etat.svelte';
  import Pastille from './Pastille.svelte';

  /** Le temps que la bulle reste à l'écran (conception, section 19). */
  const DUREE = 10000;

  // Chaque nouvelle annonce repart pour dix secondes.
  $effect(() => {
    if (etat.annonce === null) return;
    const minuterie = setTimeout(() => etat.fermerAnnonce(), DUREE);
    return () => clearTimeout(minuterie);
  });
</script>

<!-- Par-dessus tous les écrans. La phrase en toutes lettres est dite par la zone d'état, toujours présente ;
     la bulle touchée ouvre l'historique pour une nouvelle liste, et se ferme sinon. -->
<span class="visuel-cache" role="status">{etat.annonce !== null ? annonceDite(etat.annonce) : ''}</span>
<div class="zone">
  {#if etat.annonce !== null}
    <Pastille
      etiquette={etat.annonce.sorte === 'nouvelle' && etat.ecran !== 'historique' ? 'Voir l’historique de la liste' : 'Fermer'}
      onclick={() => etat.ouvrirAnnonce()}>{texteAnnonce(etat.annonce)}</Pastille
    >
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
