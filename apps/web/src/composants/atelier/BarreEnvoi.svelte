<script lang="ts">
  import { decrireModifications } from '@jolis-mots/core';
  import type { Atelier } from '../../atelier.svelte';

  let { atelier }: { atelier: Atelier } = $props();

  const total = $derived(atelier.modifications.total);
</script>

<!-- La barre du haut : le titre, les modifications pas encore envoyées, « Envoyer au téléphone ». -->
<header class="barre">
  <h1>Atelier</h1>
  <div class="envoi">
    {#if atelier.disponible}
      <div class="compteur">
        {#if total === 0}
          <p class="nombre envoye">Tout est envoyé</p>
        {:else}
          <p class="nombre">
            <span class="chiffre">{total}</span>
            {total === 1 ? 'modification pas encore envoyée' : 'modifications pas encore envoyées'}
          </p>
          <p class="detail">{decrireModifications(atelier.modifications)}</p>
        {/if}
      </div>
    {/if}
    <button disabled={!atelier.disponible || total === 0 || atelier.envoi} onclick={() => atelier.envoyer().catch(() => undefined)}>
      {atelier.envoi ? 'Envoi…' : 'Envoyer au téléphone'}
    </button>
  </div>
</header>

<style>
  .barre {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px 24px;
    padding: 4px 32px 14px;
    border-bottom: 1px solid var(--filet);
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 500;
  }

  .envoi {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
  }

  .compteur {
    text-align: right;
  }

  .compteur p {
    margin: 0;
  }

  .nombre {
    font-size: 17px;
    color: var(--encre);
  }

  /* Rien en attente : discret, comme sur la maquette. */
  .envoye {
    font-style: italic;
    color: var(--second);
  }

  .chiffre {
    font-weight: 600;
    font-variant-numeric: lining-nums tabular-nums;
    color: var(--accent);
  }

  .detail {
    font-size: 15px;
    font-style: italic;
    color: var(--second);
  }

  /* Comme « Enregistrer » : le bouton principal de l'atelier. */
  button {
    height: 44px;
    padding: 0 22px;
    border: none;
    border-radius: 22px;
    background: var(--accent);
    color: var(--papier);
    font-size: 18px;
    cursor: pointer;
  }

  button:disabled {
    cursor: default;
    opacity: 0.45;
  }
</style>
