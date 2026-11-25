<script lang="ts">
  import {
    adresseCnrtl,
    BOUTONS_SAISIE,
    developper,
    genresUtilises,
    homonymes,
    insertionPour,
    lignesDeSources,
    type Mot,
    type Proposition,
  } from '@jolis-mots/core';
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
      phrases.push(`Ce mot existe déjà\u202F: ${memes.parMot.map((m) => (m.genre === '' ? m.mot : `${m.mot} (${m.genre})`)).join(', ')}.`);
    }
    // Un mot déjà nommé pour son Mot ne l'est pas une seconde fois pour son Tri.
    const parTri = memes.parTri.filter((m) => !memes.parMot.includes(m));
    if (parTri.length > 0) phrases.push(`Ce tri est déjà celui de\u202F: ${parTri.map((m) => m.mot).join(', ')}.`);
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
    if (atelier.brouillon === null || atelier.brouillon.mot.trim() === '' || atelier.demande !== null || atelier.enregistrement) return;
    atelier.enregistrerBrouillon().catch(() => undefined);
  }

  function ouvrirCnrtl(): void {
    const tri = atelier.brouillon?.tri ?? '';
    if (tri.trim() !== '') pont?.ouvrirCnrtl(adresseCnrtl(tri)).catch(() => undefined);
  }

  let zone: HTMLTextAreaElement | undefined = $state();
  /** « ⋯ » a déplié les autres boutons de la barre. */
  let barreDepliee = $state(false);
  const boutonsVisibles = $derived(BOUTONS_SAISIE.filter((b) => b.principal || barreDepliee));

  /**
   * Remplace la sélection de la définition par `texte`, par l'édition du navigateur : Ctrl+Z l'annule
   * comme une frappe, et l'événement `input` passe le texte au brouillon.
   */
  function inserer(z: HTMLTextAreaElement, texte: string): void {
    if (texte === '') return;
    if (!document.execCommand('insertText', false, texte)) {
      // Sans execCommand : le texte est posé tout de même (sans annulation possible).
      z.setRangeText(texte, z.selectionStart, z.selectionEnd, 'end');
      z.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /** Un bouton de la barre : son texte au curseur, et le curseur reste dans la zone. */
  function inserBouton(abreviation: string): void {
    const z = zone;
    if (z === undefined) return;
    z.focus();
    inserer(z, insertionPour(abreviation, z.value.slice(0, z.selectionStart)));
  }

  /** Tab après une abréviation la développe ; sinon, Tab garde son rôle. */
  function toucheDefinition(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const z = e.currentTarget as HTMLTextAreaElement;
    if (z.selectionStart !== z.selectionEnd) return;
    const d = developper(z.value.slice(0, z.selectionStart));
    if (d === null) return;
    e.preventDefault();
    z.setSelectionRange(z.selectionStart - d.longueur, z.selectionStart);
    inserer(z, d.insertion);
  }

  /** Une ligne de remarque ou de proposition. */
  interface Ligne {
    cle: string;
    texte: string;
    incertaine: boolean;
    corriger: (() => void) | null;
    taire: () => void;
    libelleTaire: string;
  }

  const CHAMPS: Record<Proposition['champ'], string> = { definition: '', genre: 'Genre\u202F: ', sources: 'Source\u202F: ' };

  const lignesRemarques: Ligne[] = $derived.by(() => {
    const b = atelier.brouillon;
    if (b === null) return [];
    return [
      ...atelier.remarquesFiche.map((r) => ({
        cle: `r:${r.code}`,
        texte: r.texte,
        incertaine: false,
        corriger: r.correction === null ? null : () => atelier.corriger(r.code),
        taire: () => atelier.ignorer(b.id, r.code),
        libelleTaire: 'C’est voulu',
      })),
      ...atelier.propositionsFiche.map((p) => ({
        cle: `p:${p.champ}:${p.avant}:${p.apres}`,
        texte: `${CHAMPS[p.champ]}${p.avant} → ${p.apres} · ${p.raison}`,
        incertaine: p.certitude === 'faible',
        corriger: () => atelier.appliquerProposition(p),
        taire: () => atelier.refuserProposition(p),
        libelleTaire: 'Non',
      })),
    ];
  });
  /** Au plus trois lignes, puis « et N autres », qui déplie le reste pour ce mot. */
  const MAX_REMARQUES = 3;
  let depliePour = $state<string | null>(null);
  const remarquesDepliees = $derived(depliePour !== null && depliePour === atelier.brouillon?.id);
  const lignesVisibles = $derived(
    remarquesDepliees || lignesRemarques.length <= MAX_REMARQUES ? lignesRemarques : lignesRemarques.slice(0, MAX_REMARQUES),
  );

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

      {#if lignesRemarques.length > 0}
        {@const reste = lignesRemarques.length - lignesVisibles.length}
        <ul class="remarques" aria-label="Remarques sur le mot">
          {#each lignesVisibles as l, i (l.cle)}
            <li>
              {#if l.incertaine}<span class="incertaine" title="Proposition incertaine">?</span>{/if}
              <span class="texte" title={l.texte}>{l.texte}</span>
              {#if l.corriger !== null}<button class="lien" onclick={l.corriger}>Corriger</button>{/if}
              <button class="lien taire" onclick={l.taire}>{l.libelleTaire}</button>
              <!-- Les autres se déplient depuis la troisième ligne : le bloc garde trois lignes. -->
              {#if reste > 0 && i === lignesVisibles.length - 1}
                <button class="lien autres" onclick={() => (depliePour = b.id)}>et {reste} autre{reste > 1 ? 's' : ''}</button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <div class="champ definition">
        <div class="tete">
          <label for="f-def">Définition</label>
          <div class="barre" role="toolbar" aria-label="Insérer une balise" aria-controls="f-def">
            {#each boutonsVisibles as bouton (bouton.abreviation)}
              <button
                title={`Abréviation\u202F: ${bouton.abreviation}, puis Tab`}
                onmousedown={(e) => e.preventDefault()}
                onclick={() => inserBouton(bouton.abreviation)}>{bouton.texte}</button
              >
            {/each}
            <button
              class="plus"
              aria-expanded={barreDepliee}
              title={barreDepliee ? 'Moins de balises' : 'Autres balises'}
              onmousedown={(e) => e.preventDefault()}
              onclick={() => (barreDepliee = !barreDepliee)}>⋯</button
            >
          </div>
        </div>
        <textarea
          id="f-def"
          rows="9"
          bind:this={zone}
          value={b.definition}
          oninput={(e) => poser('definition', e.currentTarget.value)}
          onkeydown={toucheDefinition}
        ></textarea>
      </div>

      <div class="champ">
        <div class="tete">
          <label for="f-source">Source</label>
          <span class="aide" id="f-source-aide">Une ligne par livre&#x202F;: Auteur: Titre (page)</span>
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

    <!-- Une ligne : la case, les deux liens, puis « Enregistrer » à droite. -->
    <div class="pied">
      <label class="case">
        <input type="checkbox" checked={b.aCompleter} onchange={(e) => poser('aCompleter', e.currentTarget.checked)} />
        <span>À compléter</span>
      </label>
      <div class="liens">
        <button class="lien-pied" disabled={b.tri.trim() === ''} onclick={ouvrirCnrtl}>Ouvrir dans le CNRTL</button>
        <button class="lien-pied" disabled={!enregistre} onclick={() => atelier.demanderSuppression()}>Supprimer ce mot</button>
      </div>
      <button class="enregistrer" disabled={b.mot.trim() === '' || !atelier.modifiee || atelier.enregistrement} onclick={enregistrer}>
        {atelier.enregistrement ? 'Enregistrement…' : 'Enregistrer'}
      </button>
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

  /* Comme la barre d'actions de l'écran Mot : un filet, puis une ligne, hors du défilement. */
  /* Quand la place manque, les deux liens se rangent l'un sous l'autre : le pied garde une ligne. */
  .pied {
    flex-shrink: 0;
    padding: 6px 36px;
    border-top: 1px solid var(--filet);
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .liens {
    flex: 1 1 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 14px;
  }

  .lien-pied {
    height: auto;
    padding: 1px 2px;
    line-height: 1.25;
    border: none;
    background: transparent;
    color: var(--second);
    font-size: 15px;
    white-space: nowrap;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* Les remarques : petites, une ligne chacune ; rien quand il n'y en a pas. */
  .remarques {
    margin: -6px 0 -8px;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
  }

  .remarques li {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 12px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--second);
  }

  .remarques .texte {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .incertaine {
    flex-shrink: 0;
    margin-right: -6px;
    font-weight: 600;
  }

  .remarques .lien {
    flex-shrink: 0;
    height: auto;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--encre);
    font-size: 15px;
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }

  .remarques .lien.taire {
    color: var(--second);
  }

  .remarques .lien.autres {
    margin-left: auto;
    color: var(--second);
    font-style: italic;
  }

  /* La barre d'abréviations : petite, sur la ligne du titre de la définition. */
  .definition .tete {
    align-items: center;
  }

  /* Toute la barre passe sous le titre quand elle n'y tient pas à côté ; elle ne se coupe qu'en dernier recours. */
  .barre {
    flex: 0 0 auto;
    max-width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .barre button {
    height: 25px;
    padding: 0 5px;
    border: 1px solid var(--filet);
    border-radius: 4px;
    background: transparent;
    color: var(--encre);
    font-size: 14px;
    line-height: 1;
    white-space: nowrap;
  }

  .barre button:hover {
    border-color: var(--second);
  }

  .barre .plus {
    color: var(--second);
  }

  @media (max-width: 1180px) {
    .champs,
    .pied {
      padding-inline: 20px;
    }

    .pied {
      gap: 8px;
    }

    .liens {
      column-gap: 10px;
    }

    .lien-pied {
      font-size: 14px;
    }

    .case {
      gap: 6px;
    }

    .case span {
      font-size: 12px;
      letter-spacing: 0.04em;
    }

    .enregistrer {
      padding: 0 14px;
      font-size: 17px;
    }

    .barre {
      gap: 2px;
    }

    .barre button {
      padding: 0 3px;
      font-size: 13px;
    }
  }

  /* La colonne la plus étroite : le pied garde sa ligne. */
  @media (max-width: 1100px) {
    .lien-pied {
      font-size: 13px;
    }

    .enregistrer {
      padding: 0 12px;
    }
  }

  /* Sur un écran bas, moins de blanc autour des champs : la hauteur va à la définition. */
  @media (max-height: 820px) {
    .champs {
      padding-top: 18px;
      gap: 12px;
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
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
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
    letter-spacing: 0.1em;
    white-space: nowrap;
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

  .enregistrer {
    flex-shrink: 0;
    height: 40px;
    padding: 0 20px;
    white-space: nowrap;
    border: none;
    border-radius: 22px;
    background: var(--accent);
    color: var(--papier);
  }
</style>
