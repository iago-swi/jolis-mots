<script lang="ts">
  import Fiche from '../composants/Fiche.svelte';
  import { etat } from '../etat.svelte';

  /** Distance horizontale, en px, au-delà de laquelle un glissement change de mot. */
  const SEUIL = 60;

  const mot = $derived(etat.motCourant);
  const favori = $derived(mot !== null && etat.favoris.includes(mot.id));

  let depart: { x: number; y: number } | null = null;
  let defilement: HTMLElement | undefined = $state();

  /** Le doigt ou le stylet seulement : à la souris, glisser sélectionne le texte (pour le copier). */
  function poser(e: PointerEvent): void {
    depart = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
  }

  function lever(e: PointerEvent): void {
    if (depart === null) return;
    const dx = e.clientX - depart.x;
    const dy = e.clientY - depart.y;
    depart = null;
    if (Math.abs(dx) <= SEUIL || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) etat.suivant();
    else etat.precedent();
  }

  // Chaque nouveau mot s'ouvre en haut de sa fiche.
  $effect(() => {
    void mot;
    defilement?.scrollTo({ top: 0 });
  });
</script>

{#if etat.complets.length === 0}
  <p class="vide">Aucun mot à lire pour l'instant.</p>
{:else}
  <div
    class="defilement"
    role="region"
    aria-label="Fiche du mot"
    bind:this={defilement}
    onpointerdown={poser}
    onpointerup={lever}
    onpointercancel={() => (depart = null)}
  >
    {#if mot !== null}
      <Fiche {mot} />
    {/if}
  </div>

  <div class="actions">
    <button
      class="etoile"
      class:favori
      aria-label="Marquer ce mot comme favori"
      aria-pressed={favori}
      disabled={mot === null}
      onclick={() => mot !== null && etat.basculerFavori(mot.id)}
    >
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill={favori ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"></path></svg>
    </button>
    <button class="principal" onclick={() => etat.suivant()}>Mot suivant</button>
  </div>
{/if}

<style>
  .vide {
    margin: auto;
    padding: 0 28px;
    font-size: 20px;
    font-style: italic;
    text-align: center;
    color: var(--second);
  }

  .defilement {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    padding: 46px 28px 24px;
  }

  .actions {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 14px 28px 18px;
  }

  button {
    height: 52px;
    border-radius: 26px;
    cursor: pointer;
  }

  .etoile {
    flex-shrink: 0;
    width: 52px;
    padding: 0;
    border: 1px solid var(--encre);
    background: transparent;
    color: var(--encre);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .etoile.favori {
    color: var(--accent);
  }

  .principal {
    flex: 1 1 0;
    border: none;
    background: var(--encre);
    color: var(--papier);
    font-size: 19px;
  }
</style>
