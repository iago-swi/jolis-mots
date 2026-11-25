<script lang="ts">
  import type { Mot } from '@jolis-mots/core';
  import Fiche from '../Fiche.svelte';

  let { mot }: { mot: Mot | null } = $props();
</script>

<aside class="apercu" aria-label="Aperçu sur le téléphone">
  <h2>Aperçu sur le téléphone</h2>
  {#if mot !== null}
    <!-- La largeur d'un téléphone : les lignes tombent comme elles tomberont là-bas. -->
    <div class="cadre"><Fiche {mot} /></div>
  {/if}
  <p class="note">
    La fiche se met en forme toute seule à partir de tes balises. La typographie est corrigée à l’affichage&#x202F;: apostrophes,
    guillemets, espaces fines.
  </p>
</aside>

<style>
  .apercu {
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* La barre de défilement a sa place réservée : le cadre de 390 px n'est jamais rogné. */
    scrollbar-gutter: stable;
    padding: 28px 28px 28px 24px;
    border-left: 1px solid var(--filet);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--second);
  }

  .cadre {
    flex-shrink: 0;
    width: 390px;
    padding: 36px 28px;
    border: 1px solid var(--filet);
    border-radius: 20px;
  }

  .note {
    max-width: 390px;
    margin: 0;
    font-size: 15px;
    line-height: 1.4;
    font-style: italic;
    color: var(--second);
  }

  /* Fenêtre étroite : le cadre garde ses 390 px de mise en page, montré plus petit. */
  @media (max-width: 1180px) {
    .cadre {
      zoom: 0.8;
    }

    .note {
      max-width: 312px;
    }
  }

  /* Plus étroite encore : la fiche, à sa largeur, garde la place de ses boutons. */
  @media (max-width: 1100px) {
    .cadre {
      zoom: 0.7;
    }

    .note {
      max-width: 273px;
    }
  }
</style>
