<script lang="ts">
  import { etat, SEANCES_POSSIBLES, type Palette } from '../etat.svelte';

  const PALETTES: { id: Palette; nom: string }[] = [
    { id: 'systeme', nom: 'Comme le système' },
    { id: 'papier', nom: 'Papier' },
    { id: 'nuit', nom: 'Nuit' },
    { id: 'ivoire', nom: 'Ivoire' },
    { id: 'ceruleen', nom: 'Céruléen' },
  ];

  const dateListe = $derived.by(() => {
    const t = Date.parse(etat.liste.publie);
    return Number.isNaN(t) ? 'inconnue' : new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long' }).format(t);
  });

  let confirmation = $state(false);
  let question: HTMLElement | undefined = $state();

  // La question apparaît en bas de l'écran : on la ramène dans la zone visible, sans animation.
  $effect(() => {
    if (confirmation) question?.scrollIntoView({ block: 'nearest' });
  });

  function effacer(): void {
    etat.effacerProgres();
    confirmation = false;
  }
</script>

<div class="reglages">
  <div class="defilement">
    <header class="titre">
      <button class="retour" onclick={() => etat.allerA(etat.ecranAvantReglages)}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>
        Retour
      </button>
      <h1>Réglages</h1>
    </header>

    <fieldset>
      <legend>Mots par séance</legend>
      <div class="choix">
        {#each SEANCES_POSSIBLES as n (n)}
          <label class="pastille">
            <input type="radio" name="seance" value={n} checked={etat.reglages.motsParSeance === n} onchange={() => etat.reglerSeance(n)} />
            <span>{n}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Palette</legend>
      <div class="palettes">
        {#each PALETTES as p (p.id)}
          <label class="palette">
            <input type="radio" name="palette" value={p.id} checked={etat.reglages.palette === p.id} onchange={() => etat.reglerPalette(p.id)} />
            <span class="echantillon" aria-hidden="true" style:background="var(--ech-{p.id}-papier)">
              <i style:background="var(--ech-{p.id}-encre)"></i>
              <i style:background="var(--ech-{p.id}-accent)"></i>
            </span>
            <span class="nom">{p.nom}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <dl class="infos">
      <div><dt>Version</dt><dd>{__APP_VERSION__}</dd></div>
      <div><dt>Liste des mots</dt><dd>{dateListe}</dd></div>
    </dl>

    <div class="effacer">
      {#if confirmation}
        <div role="alertdialog" aria-labelledby="question-effacer" bind:this={question}>
          <p id="question-effacer">Effacer les mots vus, les révisions et les favoris ?</p>
          <div class="boutons">
            <button class="danger" onclick={effacer}>Effacer</button>
            <button onclick={() => (confirmation = false)}>Annuler</button>
          </div>
        </div>
      {:else}
        <button class="lien" onclick={() => (confirmation = true)}>Effacer mes progrès</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .reglages {
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .defilement {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 14px 28px 24px;
  }

  .titre {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  h1 {
    margin: 0;
    font-size: 34px;
    font-weight: 500;
  }

  .retour {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    margin-left: -8px;
    padding: 0 8px;
    border: none;
    background: transparent;
    font-size: 17px;
    color: var(--second);
    cursor: pointer;
  }

  fieldset {
    margin: 20px 0 0;
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    margin-bottom: 10px;
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--second);
  }

  input[type='radio'] {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }

  .choix {
    display: flex;
    gap: 8px;
  }

  .pastille span {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    height: 48px;
    border: 1px solid var(--second);
    border-radius: 24px;
    font-size: 20px;
    cursor: pointer;
  }

  .pastille input:checked + span {
    border-color: var(--encre);
    background: var(--encre);
    color: var(--papier);
  }

  .palettes {
    display: flex;
    flex-direction: column;
  }

  .palette {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 52px;
    padding: 4px 0;
    border-top: 1px solid var(--filet);
    cursor: pointer;
  }

  .echantillon {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 64px;
    height: 36px;
    border: 1px solid var(--second);
    border-radius: 8px;
  }

  .echantillon i {
    width: 14px;
    height: 14px;
    border-radius: 50%;
  }

  .nom {
    flex-grow: 1;
    font-size: 20px;
  }

  .palette input:checked ~ .nom {
    color: var(--accent);
    font-weight: 600;
  }

  .palette input:checked ~ .nom::after {
    content: ' ✓';
  }

  input:focus-visible + span,
  input:focus-visible ~ .echantillon {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .infos {
    margin: 24px 0 0;
  }

  .infos div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 12px 0;
    border-top: 1px solid var(--filet);
  }

  dt {
    font-size: 20px;
  }

  dd {
    margin: 0;
    font-size: 18px;
    font-style: italic;
    color: var(--second);
  }

  .effacer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid var(--filet);
  }

  .effacer p {
    margin: 0 0 12px;
    font-size: 20px;
  }

  .boutons {
    display: flex;
    gap: 12px;
  }

  .boutons button {
    flex: 1 1 0;
    height: 52px;
    border: 1px solid var(--encre);
    border-radius: 26px;
    background: transparent;
    font-size: 19px;
    cursor: pointer;
  }

  .boutons .danger {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--papier);
  }

  .lien {
    min-height: 44px;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 19px;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
