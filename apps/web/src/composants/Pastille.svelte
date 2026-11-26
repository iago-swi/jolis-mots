<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * L'annonce d'une nouvelle liste et les résultats de « Vérifier maintenant » : partout le même aspect.
   * Avec `onclick`, c'est un bouton ; sans, un simple texte.
   */
  let { children, onclick, etiquette }: { children: Snippet; onclick?: () => void; etiquette?: string } = $props();
</script>

{#if onclick}
  <button class="pastille" aria-label={etiquette} {onclick}>{@render children()}</button>
{:else}
  <span class="pastille">{@render children()}</span>
{/if}

<style>
  .pastille {
    display: inline-flex;
    align-items: center;
    pointer-events: auto;
    max-width: 100%;
    min-height: 36px;
    padding: 6px 16px;
    border: none;
    border-radius: 18px;
    /* Comme « Mot suivant » : bien visible dans chaque thème, sans couleur de plus. */
    background: var(--encre);
    color: var(--papier);
    font: inherit;
    font-size: 15px;
    line-height: 1.3;
    text-align: left;
  }

  button.pastille {
    cursor: pointer;
  }

  @media (prefers-reduced-motion: no-preference) {
    .pastille {
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
