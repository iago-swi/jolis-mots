<script lang="ts">
  import { etat, type Ecran } from '../etat.svelte';

  const onglets: { ecran: Ecran; nom: string }[] = [
    { ecran: 'mot', nom: 'Mot' },
    { ecran: 'quiz', nom: 'Quiz' },
    { ecran: 'recueil', nom: 'Recueil' },
  ];
</script>

<nav class="onglets" aria-label="Navigation principale">
  {#each onglets as o (o.ecran)}
    <a
      href="#{o.ecran}"
      class:actif={etat.ecran === o.ecran}
      aria-current={etat.ecran === o.ecran ? 'page' : undefined}
      onclick={(e) => {
        e.preventDefault();
        etat.allerA(o.ecran);
      }}
    >
      {#if o.ecran === 'mot'}
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 5.5c2.5-1 5.5-1 8 .5 2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"></path><path d="M12 6v13"></path></svg>
      {:else if o.ecran === 'quiz'}
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M8.5 12.2l2.4 2.4 4.6-5"></path></svg>
      {:else}
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h9"></path></svg>
      {/if}
      <span>{o.nom}</span>
    </a>
  {/each}
</nav>

<style>
  .onglets {
    display: flex;
    flex-shrink: 0;
    /* Les onglets restent au-dessus de la barre de gestes ; le fond s'étend dessous. */
    height: calc(66px + var(--marge-bas));
    padding-bottom: var(--marge-bas);
    border-top: 1px solid var(--filet);
  }

  a {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-decoration: none;
    color: var(--second);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  a.actif {
    color: var(--encre);
    box-shadow: inset 0 2px 0 var(--accent);
  }
</style>
