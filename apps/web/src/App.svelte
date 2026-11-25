<script lang="ts">
  import { atelier } from './atelier.svelte';
  import Entete from './composants/Entete.svelte';
  import Onglets from './composants/Onglets.svelte';
  import { ecranDeLAdresse, etat } from './etat.svelte';
  import Atelier from './ecrans/Atelier.svelte';
  import Mot from './ecrans/Mot.svelte';
  import Quiz from './ecrans/Quiz.svelte';
  import Recueil from './ecrans/Recueil.svelte';
  import Historique from './ecrans/Historique.svelte';
  import Reglages from './ecrans/Reglages.svelte';

  $effect(() => {
    document.documentElement.dataset.palette = etat.paletteAffichee;
  });
</script>

<svelte:window onhashchange={() => etat.allerA(ecranDeLAdresse(location.hash))} />

<div class="application" class:bureau={atelier !== null} class:pleine={etat.ecran === 'atelier'}>
  <Entete />
  <main class="ecran">
    {#if etat.ecran === 'mot'}
      <Mot />
    {:else if etat.ecran === 'quiz'}
      <Quiz />
    {:else if etat.ecran === 'recueil'}
      <Recueil />
    {:else if etat.ecran === 'atelier'}
      <Atelier />
    {:else if etat.ecran === 'historique'}
      <Historique />
    {:else}
      <Reglages />
    {/if}
  </main>
  <Onglets />
</div>

<style>
  .application {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .ecran {
    position: relative;
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /*
   * Sur bureau, les écrans de lecture tiennent dans une colonne centrée, la largeur du téléphone
   * en plus aisé ; l'en-tête et les onglets s'y alignent. L'Atelier prend toute la largeur,
   * l'en-tête avec lui ; les onglets restent dans la colonne.
   */
  .bureau {
    --colonne: 560px;
    --colonne-entete: var(--colonne);
  }

  .bureau:not(.pleine) .ecran {
    width: 100%;
    max-width: var(--colonne);
    margin-inline: auto;
  }

  .bureau.pleine {
    --colonne-entete: 100%;
  }
</style>
