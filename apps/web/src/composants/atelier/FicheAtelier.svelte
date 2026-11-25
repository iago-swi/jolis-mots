<script lang="ts">
  import {
    adresseCnrtl,
    BOUTONS_SAISIE,
    cleProposition,
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
    if (texte === '' && z.selectionStart === z.selectionEnd) return;
    const fait = texte === '' ? document.execCommand('delete') : document.execCommand('insertText', false, texte);
    if (!fait) {
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

  /**
   * Pose une définition corrigée par la zone de saisie : seul le passage qui change est remplacé, par
   * l'édition du navigateur, pour que Ctrl+Z rende le texte d'avant. Sans zone, le brouillon la prend.
   */
  function remplacerDefinition(texte: string): void {
    const z = zone;
    if (z === undefined) {
      poser('definition', texte);
      return;
    }
    const avant = z.value;
    let debut = 0;
    while (debut < avant.length && debut < texte.length && avant[debut] === texte[debut]) debut++;
    let fin = 0;
    while (fin < avant.length - debut && fin < texte.length - debut && avant[avant.length - 1 - fin] === texte[texte.length - 1 - fin]) fin++;
    z.focus();
    z.setSelectionRange(debut, avant.length - fin);
    inserer(z, texte.slice(debut, texte.length - fin));
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
        corriger: r.correction === null ? null : () => atelier.corriger(r.code, remplacerDefinition),
        taire: () => atelier.ignorer(b.id, r.code),
        libelleTaire: 'C’est voulu',
      })),
      ...atelier.propositionsFiche.map((p) => ({
        cle: `p:${cleProposition(p)}`,
        texte: `${CHAMPS[p.champ]}${p.avant} → ${p.apres} · ${p.raison}`,
        incertaine: p.certitude === 'faible',
        corriger: () => atelier.appliquerProposition(p, remplacerDefinition),
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
      <!-- Mot, Tri, Genre, puis Note et Util., tout petits : leur contenu tient en quelques lettres.
           Dans une fiche étroite, Genre, Note et Util. passent sur une deuxième ligne. -->
      <div class="rangee premiere">
        <div class="champ mot">
          <label for="f-mot">Mot</label>
          <input id="f-mot" type="text" autocomplete="off" value={b.mot} oninput={(e) => atelier.saisirMot(e.currentTarget.value)} />
        </div>
        <div class="champ tri">
          <label for="f-tri">Tri</label>
          <input id="f-tri" type="text" autocomplete="off" spellcheck="false" value={b.tri} oninput={(e) => atelier.saisirTri(e.currentTarget.value)} />
        </div>
        <div class="champ genre">
          <label for="f-genre">Genre</label>
          <input id="f-genre" type="text" autocomplete="off" spellcheck="false" list="f-genres" value={b.genre} oninput={(e) => poser('genre', e.currentTarget.value)} />
          <datalist id="f-genres">
            {#each genres as g (g)}<option value={g}></option>{/each}
          </datalist>
        </div>
        <div class="champ petit note">
          <label for="f-note" title="Note&#x202F;: pour marquer les plus intéressants">Note</label>
          <input
            id="f-note"
            type="text"
            autocomplete="off"
            spellcheck="false"
            title="Note&#x202F;: pour marquer les plus intéressants"
            value={b.note}
            oninput={(e) => poser('note', e.currentTarget.value)}
          />
        </div>
        <div class="champ petit util">
          <label for="f-util" title="Utilisé dans mes livres">Util.</label>
          <input
            id="f-util"
            type="text"
            autocomplete="off"
            spellcheck="false"
            aria-label="Utilisé dans mes livres"
            title="Utilisé dans mes livres"
            value={b.util}
            oninput={(e) => poser('util', e.currentTarget.value)}
          />
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
          <label for="f-def" title="Tes balises habituelles&#x202F;: 1. 2. · [Litt.] · EX: · SYN: · US:">Définition</label>
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
    </div>

    <!-- Une ligne : la case, les deux liens côte à côte, puis « Enregistrer » à droite. -->
    <div class="pied">
      <label class="case">
        <input type="checkbox" checked={b.aCompleter} onchange={(e) => poser('aCompleter', e.currentTarget.checked)} />
        <span>À compléter</span>
      </label>
      <div class="liens">
        <!-- Dans une fiche étroite, les liens se disent plus court ; leur nom entier reste celui du bouton. -->
        <button class="lien-pied" aria-label="Ouvrir dans le CNRTL" title="Ouvrir dans le CNRTL" disabled={b.tri.trim() === ''} onclick={ouvrirCnrtl}
          ><span class="long">Ouvrir dans le CNRTL</span><span class="court">CNRTL</span></button
        >
        <button class="lien-pied" aria-label="Supprimer ce mot" title="Supprimer ce mot" disabled={!enregistre} onclick={() => atelier.demanderSuppression()}
          ><span class="long">Supprimer ce mot</span><span class="court">Supprimer</span></button
        >
      </div>
      <!-- Les deux libellés occupent la même place : le bouton garde la largeur du plus long. -->
      <button class="enregistrer" disabled={b.mot.trim() === '' || !atelier.modifiee || atelier.enregistrement} onclick={enregistrer}>
        <span class="pile">
          <span class:cache={atelier.enregistrement}>Enregistrer</span>
          <span class:cache={!atelier.enregistrement}>Enregistrement…</span>
        </span>
      </button>
    </div>
  {/if}
</section>

<style>
  .fiche-atelier {
    /* Les réglages étroits suivent la largeur de la fiche, non celle de la fenêtre. */
    container-type: inline-size;
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

  /* Comme la barre d'actions de l'écran Mot : un filet, puis une seule ligne, hors du défilement. */
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
    align-items: center;
    gap: 14px;
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

  /* `pre` : une espace double citée (« Un  deux ») reste visible ; la remarque tient sur une ligne. */
  .remarques .texte {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: pre;
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

  /*
   * Mot et Genre un peu plus larges que Tri ; Note et Util. à la mesure de leur contenu. Le genre a
   * toujours la place du plus long de la liste (« verbe trans. + verbe intrans. », 210 px en 20 px).
   */
  .premiere {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(250px, 1.2fr) auto auto;
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

  .petit label {
    white-space: nowrap;
  }

  /* Un chiffre pour la note, deux ou trois lettres pour Util. (L, LL, LLL, X). */
  #f-note,
  #f-util {
    padding: 0 6px;
    text-align: center;
  }

  #f-note {
    width: calc(4ch + 14px);
  }

  #f-util {
    width: calc(5ch + 14px);
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

  .court {
    display: none;
  }

  .pile {
    display: inline-grid;
  }

  .pile > span {
    grid-area: 1 / 1;
  }

  .cache {
    visibility: hidden;
  }

  /* Les réglages étroits viennent en dernier : ils l'emportent sur les règles de base. */

  /*
   * Fiche de moins de 800 px (fenêtres de 1280 et 1000 px) : cinq champs ne tiennent plus sur une
   * ligne sans couper le genre ou le mot. Mot et Tri restent en haut ; Genre, Note et Util. passent
   * dessous, le genre sur la largeur de Mot et Tri.
   */
  @container (max-width: 800px) {
    .premiere {
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto auto;
      grid-template-areas:
        'mot tri tri tri'
        'genre genre note util';
    }

    .premiere .mot {
      grid-area: mot;
    }

    .premiere .tri {
      grid-area: tri;
    }

    .premiere .genre {
      grid-area: genre;
    }

    .premiere .note {
      grid-area: note;
    }

    .premiere .util {
      grid-area: util;
    }
  }

  /* Fiche moyenne (fenêtre de 1280 px) et étroite (1000 px) : moins de marge, un pied plus serré. */
  @container (max-width: 640px) {
    .champs,
    .pied {
      padding-inline: 20px;
    }

    .pied {
      gap: 8px;
    }

    .liens {
      gap: 8px;
    }

    .lien-pied {
      font-size: 14px;
    }

    .case {
      gap: 6px;
    }

    /* La case perd ses capitales espacées : « À compléter » en petit, comme les liens. */
    .case span {
      font-size: 14px;
      letter-spacing: 0;
      text-transform: none;
    }

    .enregistrer {
      padding: 0 12px;
      font-size: 15px;
    }

    .barre {
      gap: 2px;
    }

    .premiere {
      gap: 10px;
    }

    .premiere input[type='text'] {
      padding: 0 8px;
    }

    .premiere #f-note,
    .premiere #f-util {
      padding: 0 6px;
    }

    .barre button {
      padding: 0 3px;
      font-size: 13px;
    }
  }

  /* Fiche la plus étroite (fenêtre de 1000 px) : les liens se disent plus court pour tenir sur la ligne. */
  @container (max-width: 500px) {
    .long {
      display: none;
    }

    .court {
      display: inline;
    }

    /* La première ligne se serre encore : un texte un peu plus petit. */
    .premiere {
      gap: 8px;
    }

    .premiere input[type='text'] {
      padding: 0 6px;
      font-size: 18px;
    }

    .premiere label {
      letter-spacing: 0.1em;
    }
  }

  /* Sur un écran bas, moins de blanc autour des champs : la hauteur va à la définition. */
  @media (max-height: 820px) {
    .champs {
      padding-top: 18px;
      gap: 12px;
    }
  }
</style>
