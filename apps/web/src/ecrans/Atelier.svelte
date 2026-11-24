<script lang="ts">
  import { tick } from 'svelte';
  import { atelier as instance } from '../atelier.svelte';
  import Apercu from '../composants/atelier/Apercu.svelte';
  import FicheAtelier from '../composants/atelier/FicheAtelier.svelte';
  import ListeMots from '../composants/atelier/ListeMots.svelte';
  import { etat } from '../etat.svelte';
  import { volet } from '../volet';

  // L'écran Atelier n'existe que sur bureau, où l'atelier existe.
  const atelier = instance!;

  /** Le mot à supprimer, tel qu'il est enregistré. */
  const aSupprimer = $derived(
    atelier.demande?.genre === 'supprimer' ? (etat.liste.mots.find((m) => m.id === atelier.brouillon?.id) ?? null) : null,
  );

  /** Une fiche vide, le curseur dans le champ Mot (après la question, s'il a fallu la poser). */
  async function nouveau(): Promise<void> {
    atelier.nouveau();
    if (atelier.demande !== null) return;
    await tick();
    document.getElementById('f-mot')?.focus();
  }
</script>

<section class="atelier">
  <header class="barre">
    <h1>Atelier</h1>
    <!-- Tâche 15 : ici, le compteur des modifications, « Envoyer au téléphone », puis l'avis sous la barre. -->
  </header>

  <div class="colonnes" inert={atelier.demande !== null}>
    <ListeMots {atelier} onnouveau={nouveau} />
    <FicheAtelier {atelier} />
    <Apercu mot={atelier.brouillon} />
  </div>

  {#if atelier.demande !== null}
    <div class="voile">
      <div class="question" role="alertdialog" aria-modal="true" aria-labelledby="question-atelier" use:volet={{ fermer: () => atelier.annuler() }}>
        {#if atelier.demande.genre === 'quitter'}
          <p id="question-atelier">Quitter cette fiche sans l’enregistrer ?</p>
          <div class="boutons">
            <button class="danger" onclick={() => atelier.confirmer()}>Quitter la fiche</button>
            <button data-depart onclick={() => atelier.annuler()}>Rester</button>
          </div>
        {:else}
          <p id="question-atelier">Supprimer « {aSupprimer?.mot ?? atelier.brouillon?.mot} » ?</p>
          <div class="boutons">
            <button class="danger" onclick={() => atelier.confirmer()}>Supprimer</button>
            <button data-depart onclick={() => atelier.annuler()}>Annuler</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .atelier {
    position: relative;
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .barre {
    display: flex;
    flex-shrink: 0;
    align-items: baseline;
    padding: 4px 32px 14px;
    border-bottom: 1px solid var(--filet);
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 500;
  }

  /* Trois colonnes : la liste, la fiche, l'aperçu ; chacune défile pour elle-même. */
  .colonnes {
    flex-grow: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: clamp(260px, 25vw, 340px) minmax(0, 1fr) auto;
  }

  /* Des barres de défilement fines, aux couleurs de la palette. */
  .colonnes :global(*) {
    scrollbar-width: thin;
    scrollbar-color: var(--filet) transparent;
  }

  .voile {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: color-mix(in srgb, var(--papier) 72%, transparent);
  }

  .question {
    width: min(100%, 440px);
    padding: 28px;
    border: 1px solid var(--filet);
    border-radius: 20px;
    background: var(--papier);
  }

  .question:focus-visible {
    outline: none;
  }

  .question p {
    margin: 0 0 20px;
    font-size: 22px;
    line-height: 1.3;
  }

  .boutons {
    display: flex;
    gap: 12px;
  }

  .boutons button {
    flex: 1 1 0;
    height: 48px;
    border: 1px solid var(--encre);
    border-radius: 24px;
    background: transparent;
    font-size: 19px;
    cursor: pointer;
  }

  .boutons .danger {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--papier);
  }
</style>
