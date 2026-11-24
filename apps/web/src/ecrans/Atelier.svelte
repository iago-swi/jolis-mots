<script lang="ts">
  import { embellir } from '@jolis-mots/core';
  import { onDestroy, untrack } from 'svelte';
  import { atelier as instance, TEXTE_DIVERGENCE } from '../atelier.svelte';
  import Apercu from '../composants/atelier/Apercu.svelte';
  import BarreEnvoi from '../composants/atelier/BarreEnvoi.svelte';
  import FicheAtelier from '../composants/atelier/FicheAtelier.svelte';
  import ListeMots from '../composants/atelier/ListeMots.svelte';
  import { etat } from '../etat.svelte';
  import { pont } from '../pont';
  import { volet } from '../volet';

  // L'écran Atelier n'existe que sur bureau, où l'atelier existe.
  const atelier = instance!;

  // Le bureau demande avant de fermer la fenêtre quand une fiche est modifiée.
  $effect(() => {
    pont?.signalerFicheModifiee(atelier.modifiee);
  });
  // Quitter l'écran abandonne la fiche ; l'effet ne repasse pas après le retrait de l'écran.
  onDestroy(() => pont?.signalerFicheModifiee(atelier.modifiee));

  /** Le message de git, en anglais, quand la dernière opération a échoué. */
  const detail = $derived(atelier.depot !== null && atelier.depot.raison !== 'pret' ? atelier.depot.detail.trim() : '');
  /** La divergence reste dite tant qu'elle n'est pas réglée, même quand un autre avis a pris la place. */
  const divergenceADire = $derived(atelier.divergence && atelier.avis?.texte !== TEXTE_DIVERGENCE);

  /** Le mot à supprimer, tel qu'il est enregistré. */
  const aSupprimer = $derived(
    atelier.demande?.genre === 'supprimer' ? (etat.liste.mots.find((m) => m.id === atelier.brouillon?.id) ?? null) : null,
  );

  /**
   * Place le curseur sur l'élément `id`, après que la question qui se ferme a rendu le curseur
   * à son bouton (voir `volet`) : la tâche suivante passe après ses micro-tâches.
   */
  function placerCurseur(id: string): void {
    setTimeout(() => document.getElementById(id)?.focus());
  }

  // Chaque fois qu'une fiche nouvelle s'ouvre, directement ou après « Quitter la fiche » : le curseur dans Mot.
  let ficheOuverte: string | undefined;
  $effect(() => {
    const id = atelier.brouillon?.id;
    if (id === ficheOuverte) return;
    ficheOuverte = id;
    if (id !== undefined && untrack(() => !etat.liste.mots.some((m) => m.id === id))) placerCurseur('f-mot');
  });

  /** Oui à la question ; après une suppression faite, la fiche disparaît : le curseur va à la recherche. */
  async function confirmer(): Promise<void> {
    const genre = atelier.demande?.genre;
    await atelier.confirmer();
    if (genre === 'supprimer' && atelier.brouillon === null) placerCurseur('atelier-recherche');
    // Une fois la liste reprise, le bouton qui l'a demandée n'est plus là.
    if (genre === 'reprendre' && atelier.disponible && !atelier.divergence) placerCurseur('atelier-recherche');
  }
</script>

{#snippet avisEtDetail()}
  {#if atelier.avis !== null}
    <!-- Apostrophes typographiques à l'affichage ; le message de git, lui, reste brut. -->
    <p class="avis {atelier.avis.ton}">{embellir(atelier.avis.texte)}</p>
    {#if atelier.avis.chemin !== undefined}
      <p class="brut">{atelier.avis.chemin}</p>
    {/if}
  {/if}
  {#if detail !== ''}
    <p class="git" lang="en">{detail}</p>
  {/if}
{/snippet}

<section class="atelier">
  <div class="corps" inert={atelier.demande !== null}>
    <BarreEnvoi {atelier} />

    {#if atelier.disponible}
      <!-- La région annoncée ne porte que les phrases, et reste en place même vide ; le bouton est à côté. -->
      <div class="annonce" class:vide={atelier.avis === null && !atelier.divergence}>
        <div class="textes" role="status">
          {@render avisEtDetail()}
          {#if divergenceADire}
            <p class="avis alerte">{embellir(TEXTE_DIVERGENCE)}</p>
          {/if}
        </div>
        {#if atelier.divergence}
          <button class="reprendre" disabled={atelier.occupe} onclick={() => atelier.demanderReprise()}>Reprendre la liste en ligne</button>
        {/if}
      </div>

      <div class="colonnes">
        <ListeMots {atelier} onnouveau={() => atelier.nouveau()} />
        <FicheAtelier {atelier} />
        <Apercu mot={atelier.brouillon} />
      </div>
    {:else}
      <!-- Sans copie lisible, pas de colonnes : ce qui manque, et comment en sortir. -->
      <div class="indisponible">
        <div class="textes" role="status">
          {#if atelier.avis !== null}
            {@render avisEtDetail()}
          {:else if atelier.occupe}
            <p class="avis calme attente">L’atelier va chercher la liste…</p>
          {/if}
        </div>
        <div class="sorties">
          <button class:principal={!atelier.illisible} disabled={atelier.occupe} onclick={() => atelier.reessayer().catch(() => undefined)}>Réessayer</button>
          {#if atelier.illisible}
            <button class="principal" disabled={atelier.occupe} onclick={() => atelier.demanderReprise()}>Reprendre la liste en ligne</button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if atelier.demande !== null}
    <div class="voile">
      <div class="question" role="alertdialog" aria-modal="true" aria-labelledby="question-atelier" use:volet={{ fermer: () => atelier.annuler() }}>
        {#if atelier.demande.genre === 'quitter'}
          <p id="question-atelier">Quitter cette fiche sans l’enregistrer ?</p>
          <div class="boutons">
            <button class="danger" onclick={confirmer}>Quitter la fiche</button>
            <button data-depart onclick={() => atelier.annuler()}>Rester</button>
          </div>
        {:else if atelier.demande.genre === 'supprimer'}
          <p id="question-atelier">Supprimer « {aSupprimer?.mot ?? atelier.brouillon?.mot} » ?</p>
          <div class="boutons">
            <button class="danger" onclick={confirmer}>Supprimer</button>
            <button data-depart onclick={() => atelier.annuler()}>Annuler</button>
          </div>
        {:else}
          <p id="question-atelier">Ta version sera mise de côté dans un fichier daté, puis remplacée par la liste en ligne.</p>
          <div class="boutons">
            <button class="danger" onclick={confirmer}>Reprendre</button>
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

  .corps {
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* L'avis sous la barre : une ligne ou deux, puis les colonnes. */
  /* Les phrases à gauche ; « Reprendre la liste en ligne » à leur droite, sous elles si la place manque. */
  .annonce {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px 24px;
    padding: 10px 32px;
    border-bottom: 1px solid var(--filet);
  }

  /* Rien à dire : la région reste, sans hauteur. */
  .annonce.vide {
    padding: 0;
    border-bottom: none;
  }

  .textes {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .annonce .textes {
    flex: 1 1 420px;
  }

  .indisponible .textes {
    gap: 12px;
  }

  .avis {
    margin: 0;
    font-size: 18px;
    line-height: 1.35;
    color: var(--encre);
  }

  /* Une alerte se distingue par un filet à la marge, sans couleur criarde. */
  .avis.alerte {
    padding-left: 12px;
    border-left: 3px solid var(--accent);
  }

  .attente {
    font-style: italic;
    color: var(--second);
  }

  /* Le message de git, en anglais, et le chemin d'un fichier : montrés tels quels, à copier au besoin. */
  .git,
  .brut {
    margin: 0;
    max-height: 3lh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--filet) transparent;
    font-size: 14px;
    line-height: 1.35;
    color: var(--second);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: text;
  }

  .avis.alerte + .git {
    padding-left: 15px;
  }

  .reprendre,
  .sorties button {
    height: 44px;
    padding: 0 20px;
    border: 1px solid var(--encre);
    border-radius: 22px;
    background: transparent;
    color: var(--encre);
    font-size: 18px;
    white-space: nowrap;
    cursor: pointer;
  }

  .sorties .principal {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--papier);
  }

  .reprendre:disabled,
  .sorties button:disabled {
    cursor: default;
    opacity: 0.45;
  }

  /* Sans copie lisible : l'avis et les sorties, au centre de la page. */
  .indisponible {
    flex-grow: 1;
    align-self: center;
    width: min(100%, 620px);
    padding: 56px 32px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .indisponible .avis {
    font-size: 21px;
  }

  .sorties {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  /* Trois colonnes : la liste, la fiche, l'aperçu ; chacune défile pour elle-même. */
  .colonnes {
    flex-grow: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: clamp(240px, 24vw, 340px) minmax(0, 1fr) auto;
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
