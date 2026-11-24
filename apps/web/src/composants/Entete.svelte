<script lang="ts">
  import { etat } from '../etat.svelte';
</script>

<header class="entete">
  <span class="marque">Jolis Mots</span>
  <span class="droite">
    <button class="reglages" aria-label="Réglages" onclick={() => etat.allerA('reglages')}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path>
        <circle cx="16" cy="7" r="2"></circle>
        <circle cx="8" cy="17" r="2"></circle>
      </svg>
    </button>
  </span>
</header>

<style>
  .entete {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    /* L'en-tête commence sous la barre d'état ; son fond (celui de la page) passe dessous. */
    padding: calc(30px + var(--marge-haut)) 28px 0;
    color: var(--second);
  }

  .marque {
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .droite {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Zone tactile de 44 px, sans pousser la mise en page : les marges négatives la ramènent à la hauteur du texte. */
  .reglages {
    width: 44px;
    height: 44px;
    margin: -14px -12px -14px 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--second);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
</style>
