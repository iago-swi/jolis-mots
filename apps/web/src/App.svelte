<script lang="ts">
  import Entete from './composants/Entete.svelte';
  import Onglets from './composants/Onglets.svelte';
  import { ecranDeLAdresse, etat } from './etat.svelte';
  import Mot from './ecrans/Mot.svelte';
  import Quiz from './ecrans/Quiz.svelte';
  import Recueil from './ecrans/Recueil.svelte';
  import Reglages from './ecrans/Reglages.svelte';

  $effect(() => {
    document.documentElement.dataset.palette = etat.paletteAffichee;
  });
</script>

<svelte:window onhashchange={() => etat.allerA(ecranDeLAdresse(location.hash))} />

<div class="application">
  <Entete />
  <main class="ecran">
    {#if etat.ecran === 'mot'}
      <Mot />
    {:else if etat.ecran === 'quiz'}
      <Quiz />
    {:else if etat.ecran === 'recueil'}
      <Recueil />
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
</style>
