<script lang="ts">
  import { adresseCnrtl, genresUtilises, homonymes, lignesDeSources, type Mot } from '@jolis-mots/core';
  import type { Atelier } from '../../atelier.svelte';
  import { etat } from '../../etat.svelte';
  import { pont } from '../../pont';

  let { atelier }: { atelier: Atelier } = $props();

  const genres = $derived(genresUtilises(etat.liste.mots));
  /** Le mot choisi est déjà enregistré : il peut être supprimé. */
  const enregistre = $derived(atelier.brouillon !== null && etat.liste.mots.some((m) => m.id === atelier.brouillon!.id));
  const memes = $derived(atelier.brouillon === null ? null : homonymes(etat.liste.mots, atelier.brouillon));
  const avertissements = $derived.by(() => {
    if (memes === null) return [];
    const phrases: string[] = [];
    if (memes.parMot.length > 0) {
      phrases.push(`Ce mot existe déjà : ${memes.parMot.map((m) => (m.genre === '' ? m.mot : `${m.mot} (${m.genre})`)).join(', ')}.`);
    }
    // Un mot déjà nommé pour son Mot ne l'est pas une seconde fois pour son Tri.
    const parTri = memes.parTri.filter((m) => !memes.parMot.includes(m));
    if (parTri.length > 0) phrases.push(`Ce tri est déjà celui de : ${parTri.map((m) => m.mot).join(', ')}.`);
    return phrases;
  });

  /**
   * Le texte de la zone Source tel qu'il a été tapé, tant qu'il donne les sources du brouillon :
   * une ligne vide en cours de frappe reste à l'écran. Sinon (autre mot choisi), les sources, une par ligne.
   */
  let sourcesTapees = $state('');
  const texteSources = $derived.by(() => {
    const sources = atelier.brouillon?.sources ?? [];
    const lues = lignesDeSources(sourcesTapees);
    return lues.length === sources.length && lues.every((l, i) => l === sources[i]) ? sourcesTapees : sources.join('\n');
  });

  /** Modifie un champ du brouillon ; le texte est pris tel quel, sans rien retirer. */
  function poser<C extends 'genre' | 'definition' | 'note' | 'util' | 'aCompleter'>(champ: C, valeur: Mot[C]): void {
    if (atelier.brouillon !== null) atelier.brouillon[champ] = valeur;
  }

  function saisirSources(texte: string): void {
    sourcesTapees = texte;
    if (atelier.brouillon !== null) atelier.brouillon.sources = lignesDeSources(texte);
  }

  function enregistrer(): void {
    if (atelier.brouillon === null || atelier.brouillon.mot.trim() === '' || atelier.demande !== null) return;
    atelier.enregistrerBrouillon().catch(() => undefined);
  }

  function ouvrirCnrtl(): void {
    const tri = atelier.brouillon?.tri ?? '';
    if (tri.trim() !== '') pont?.ouvrirCnrtl(adresseCnrtl(tri)).catch(() => undefined);
  }

  /** Ctrl+S enregistre, où que soit le curseur. */
  function touche(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 's') return;
    e.preventDefault();
    enregistrer();
  }
</script>

<svelte:window onkeydown={touche} />

<section class="fiche-atelier" aria-label="Fiche du mot">
  {#if atelier.brouillon === null}
    <p class="aucune">Choisis un mot dans la liste, ou crée-en un.</p>
  {:else}
    {@const b = atelier.brouillon}
    <!-- Les champs défilent ; la case et les boutons restent en bas, toujours visibles. -->
    <div class="champs">
      <div class="rangee trois">
        <div class="champ">
          <label for="f-mot">Mot</label>
          <input id="f-mot" type="text" autocomplete="off" value={b.mot} oninput={(e) => atelier.saisirMot(e.currentTarget.value)} />
        </div>
        <div class="champ">
          <label for="f-tri">Tri</label>
          <input id="f-tri" type="text" autocomplete="off" spellcheck="false" value={b.tri} oninput={(e) => atelier.saisirTri(e.currentTarget.value)} />
        </div>
        <div class="champ">
          <label for="f-genre">Genre</label>
          <input id="f-genre" type="text" autocomplete="off" spellcheck="false" list="f-genres" value={b.genre} oninput={(e) => poser('genre', e.currentTarget.value)} />
          <datalist id="f-genres">
            {#each genres as g (g)}<option value={g}></option>{/each}
          </datalist>
        </div>
      </div>

      {#if avertissements.length > 0}
        <div class="avertissements" role="status">
          {#each avertissements as phrase (phrase)}<p>{phrase}</p>{/each}
        </div>
      {/if}

      <div class="champ definition">
        <div class="tete">
          <label for="f-def">Définition</label>
          <span class="aide" id="f-def-aide">Tes balises habituelles : 1. 2. · [Litt.] · EX: · SYN: · US:</span>
        </div>
        <textarea id="f-def" rows="9" aria-describedby="f-def-aide" value={b.definition} oninput={(e) => poser('definition', e.currentTarget.value)}></textarea>
      </div>

      <div class="champ">
        <div class="tete">
          <label for="f-source">Source</label>
          <span class="aide" id="f-source-aide">Une ligne par livre : Auteur: Titre (page)</span>
        </div>
        <textarea id="f-source" rows="2" aria-describedby="f-source-aide" value={texteSources} oninput={(e) => saisirSources(e.currentTarget.value)}></textarea>
      </div>

      <div class="rangee deux">
        <div class="champ">
          <div class="tete">
            <label for="f-note">Note</label>
            <span class="aide" id="f-note-aide">Pour marquer les plus intéressants</span>
          </div>
          <input id="f-note" type="text" autocomplete="off" aria-describedby="f-note-aide" value={b.note} oninput={(e) => poser('note', e.currentTarget.value)} />
        </div>
        <div class="champ">
          <div class="tete"><label for="f-util">Utilisé dans mes livres</label></div>
          <input id="f-util" type="text" autocomplete="off" value={b.util} oninput={(e) => poser('util', e.currentTarget.value)} />
        </div>
      </div>

    </div>

    <div class="pied">
      <div class="ligne">
        <label class="case">
          <input type="checkbox" checked={b.aCompleter} onchange={(e) => poser('aCompleter', e.currentTarget.checked)} />
          <span>À compléter</span>
        </label>
        <button class="enregistrer" disabled={b.mot.trim() === '' || !atelier.modifiee} onclick={enregistrer}>Enregistrer</button>
      </div>
      <div class="ligne secondaires">
        <button class="cnrtl" disabled={b.tri.trim() === ''} onclick={ouvrirCnrtl}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5h6v6M19 5l-8 8M10 6H6v12h12v-4"></path></svg>
          <span>Ouvrir dans le CNRTL</span>
        </button>
        <button class="supprimer" disabled={!enregistre} onclick={() => atelier.demanderSuppression()}>Supprimer ce mot</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .fiche-atelier {
    min-height: 0;
    border-left: 1px solid var(--filet);
    display: flex;
    flex-direction: column;
  }

  .champs {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 28px 36px 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* La définition prend la hauteur qui reste ; plus longue, elle grandit et les champs défilent. */
  .definition {
    flex: 1 0 auto;
  }

  .definition textarea {
    flex-grow: 1;
  }

  /* Comme la barre d'actions de l'écran Mot : un filet, puis les boutons, hors du défilement. */
  .pied {
    flex-shrink: 0;
    padding: 10px 36px 14px;
    border-top: 1px solid var(--filet);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ligne {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px 12px;
  }

  .secondaires {
    justify-content: flex-start;
  }

  @media (max-width: 1180px) {
    .champs,
    .pied {
      padding-inline: 24px;
    }
  }

  .aucune {
    margin: 0;
    padding: 40px 36px 0;
    font-size: 20px;
    font-style: italic;
    color: var(--second);
  }

  .rangee {
    display: grid;
    gap: 16px;
  }

  .trois {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }

  .deux {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .champ {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tete {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 4px 16px;
  }

  label,
  .case span {
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--second);
  }

  .aide {
    font-size: 15px;
    font-style: italic;
    color: var(--second);
  }

  input[type='text'],
  textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--second);
    border-radius: 6px;
    background: transparent;
    font: inherit;
    color: var(--encre);
  }

  input[type='text'] {
    height: 44px;
    padding: 0 12px;
    font-size: 20px;
  }

  #f-note,
  #f-util {
    font-size: 19px;
  }

  input::placeholder {
    color: var(--second);
    font-style: italic;
  }

  textarea {
    padding: 10px 12px;
    font-size: 19px;
    line-height: 1.45;
    resize: vertical;
    /* La zone grandit avec le texte : c'est la colonne qui défile, pas la zone. */
    field-sizing: content;
  }

  #f-def {
    min-height: calc(9lh + 22px);
  }

  #f-source {
    min-height: calc(2lh + 22px);
  }

  input[type='text']:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }

  .avertissements {
    margin-top: -8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .avertissements p {
    margin: 0;
    font-size: 17px;
    font-style: italic;
    color: var(--accent);
  }

  .case {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    cursor: pointer;
  }

  .case input {
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .case span {
    font-size: 13px;
    color: var(--encre);
  }

  button {
    height: 44px;
    font-size: 18px;
    cursor: pointer;
  }

  button:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .cnrtl {
    padding: 0 16px;
    border: 1px solid var(--encre);
    border-radius: 22px;
    background: transparent;
    color: var(--encre);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .supprimer {
    padding: 0 6px;
    border: none;
    background: transparent;
    color: var(--second);
    text-decoration: underline;
  }

  .enregistrer {
    padding: 0 26px;
    border: none;
    border-radius: 22px;
    background: var(--accent);
    color: var(--papier);
  }
</style>
