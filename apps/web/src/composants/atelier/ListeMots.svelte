<script lang="ts">
  import { compterFiltres, estComplet, groupesDeDoublons, listerAtelier, type FiltreAtelier } from '@jolis-mots/core';
  import type { Atelier } from '../../atelier.svelte';
  import { etat } from '../../etat.svelte';

  let { atelier, onnouveau }: { atelier: Atelier; onnouveau: () => void } = $props();

  const FILTRES: { id: FiltreAtelier; nom: string }[] = [
    { id: 'tous', nom: 'Tous les mots' },
    { id: 'complets', nom: 'Complets' },
    { id: 'aCompleter', nom: 'À compléter' },
    { id: 'doublons', nom: 'Doublons' },
  ];

  // Chaque calcul une fois par liste, ou par liste, filtre et recherche ; jamais par ligne.
  const comptes = $derived(compterFiltres(etat.liste.mots));
  const lignes = $derived(listerAtelier(etat.liste.mots, { filtre: atelier.filtre, requete: atelier.requete }));
  /** Dans le filtre Doublons, le numéro de groupe de chaque mot, pour tirer un filet entre les groupes. */
  const groupeDe = $derived.by(() => {
    const groupes = new Map<string, number>();
    if (atelier.filtre !== 'doublons') return groupes;
    groupesDeDoublons(etat.liste.mots).forEach((g, i) => g.forEach((m) => groupes.set(m.id, i)));
    return groupes;
  });
  /** La ligne qu'atteint la touche Tab : le mot choisi s'il est dans la liste, sinon la première. */
  const atteinte = $derived(lignes.some((m) => m.id === atelier.brouillon?.id) ? atelier.brouillon!.id : lignes[0]?.id);

  let liste: HTMLUListElement | undefined = $state();

  /** « 2 552 », avec une espace fine insécable entre les milliers. */
  function nombre(n: number): string {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function boutons(): HTMLButtonElement[] {
    return liste === undefined ? [] : [...liste.querySelectorAll<HTMLButtonElement>('button')];
  }

  /** Flèches, Début et Fin déplacent le curseur dans la liste ; Entrée ouvre le mot. */
  function deplacer(e: KeyboardEvent): void {
    const tous = boutons();
    const ici = tous.indexOf(document.activeElement as HTMLButtonElement);
    const cible =
      e.key === 'ArrowDown' ? ici + 1 : e.key === 'ArrowUp' ? ici - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tous.length - 1 : null;
    if (cible === null || tous.length === 0) return;
    e.preventDefault();
    tous[Math.max(0, Math.min(tous.length - 1, cible))]!.focus();
  }

  /** Depuis la recherche, la flèche du bas descend dans la liste. */
  function descendre(e: KeyboardEvent): void {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault();
    boutons()[0]?.focus();
  }
</script>

<section class="liste-mots" aria-label="Liste des mots">
  <div class="recherche">
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"></circle><path d="M15 15l5 5"></path></svg>
    <label for="atelier-recherche">Chercher un mot</label>
    <input id="atelier-recherche" type="search" placeholder="Chercher un mot" autocomplete="off" spellcheck="false" bind:value={atelier.requete} onkeydown={descendre} />
  </div>

  <div class="filtres">
    {#each FILTRES as f (f.id)}
      <button aria-pressed={atelier.filtre === f.id} onclick={() => (atelier.filtre = f.id)}>
        <span>{f.nom}</span>
        <span class:accent={f.id === 'aCompleter' && comptes.aCompleter > 0}>{nombre(comptes[f.id])}</span>
      </button>
    {/each}
  </div>

  <ul bind:this={liste}>
    {#each lignes as m, i (m.id)}
      {@const complet = estComplet(m)}
      <li class:groupe={i > 0 && groupeDe.size > 0 && groupeDe.get(m.id) !== groupeDe.get(lignes[i - 1]!.id)}>
        <button
          class:incomplet={!complet}
          aria-current={atelier.brouillon?.id === m.id ? 'true' : undefined}
          tabindex={m.id === atteinte ? 0 : -1}
          onclick={() => atelier.choisir(m.id)}
          onkeydown={deplacer}
        >
          <span class="mot">{m.mot}</span>
          {#if !complet}<span class="etat">À compléter</span>{:else if m.genre !== ''}<span class="genre">{m.genre}</span>{/if}
        </button>
      </li>
    {:else}
      <li class="vide">Aucun mot ne correspond.</li>
    {/each}
  </ul>

  <button class="nouveau" onclick={onnouveau}>Nouveau mot</button>
</section>

<style>
  .liste-mots {
    min-height: 0;
    padding: 24px 0 20px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .recherche {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 14px;
    margin-right: 24px;
    border: 1px solid var(--encre);
    border-radius: 22px;
  }

  .recherche label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .recherche input {
    flex-grow: 1;
    min-width: 0;
    height: 100%;
    border: none;
    background: transparent;
    outline: none;
    font: inherit;
    font-size: 18px;
    color: var(--encre);
  }

  /* La croix du navigateur, d'une couleur hors palette, est retirée : Échap vide le champ. */
  .recherche input::-webkit-search-cancel-button {
    appearance: none;
  }

  .recherche input::placeholder {
    color: var(--second);
  }

  .recherche:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .filtres {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    margin-right: 24px;
  }

  .filtres button {
    height: 44px;
    padding: 0 4px;
    border: none;
    border-bottom: 1px solid var(--filet);
    background: transparent;
    color: var(--second);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .filtres button[aria-pressed='true'] {
    color: var(--encre);
    font-weight: 600;
  }

  .accent {
    color: var(--accent);
    font-weight: 600;
  }

  ul {
    flex-grow: 1;
    min-height: 0;
    margin: 0;
    /* La place de la marge négative de la ligne choisie, pour qu'elle ne soit pas rognée. */
    padding: 0 0 0 10px;
    margin-left: -10px;
    list-style: none;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  li {
    /* Les lignes hors de vue ne sont pas dessinées : 2 524 lignes défilent sans à-coup. */
    content-visibility: auto;
    contain-intrinsic-size: auto 44px;
  }

  li.groupe {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--filet);
  }

  li button {
    width: 100%;
    min-height: 44px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 9px 24px 9px 4px;
    border: none;
    border-radius: 8px 0 0 8px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  /* Le curseur reste dans la liste : le contour passe à l'intérieur de la ligne. */
  li button:focus-visible {
    outline-offset: -2px;
  }

  .mot {
    min-width: 0;
    font-size: 20px;
    overflow-wrap: anywhere;
  }

  .incomplet .mot {
    color: var(--second);
  }

  .genre {
    flex-shrink: 0;
    font-size: 15px;
    font-style: italic;
    color: var(--second);
  }

  .etat {
    flex-shrink: 0;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }

  li button[aria-current='true'] {
    margin-left: -10px;
    width: calc(100% + 10px);
    padding-left: 14px;
    background: var(--encre);
    color: var(--papier);
  }

  li button[aria-current='true'] .mot {
    color: var(--papier);
    font-weight: 500;
  }

  li button[aria-current='true'] .genre,
  li button[aria-current='true'] .etat {
    color: var(--filet);
  }

  li button[aria-current='true']:focus-visible {
    outline-color: var(--accent);
    outline-offset: 2px;
  }

  .vide {
    padding: 9px 24px 9px 4px;
    font-size: 18px;
    font-style: italic;
    color: var(--second);
  }

  .nouveau {
    align-self: flex-start;
    flex-shrink: 0;
    height: 44px;
    padding: 0 20px;
    border: 1px solid var(--encre);
    border-radius: 22px;
    background: transparent;
    color: var(--encre);
    font-size: 18px;
    cursor: pointer;
  }
</style>
