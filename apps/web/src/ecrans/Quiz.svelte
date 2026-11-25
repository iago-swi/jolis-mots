<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    compterPortees,
    composerQuiz,
    developperGenre,
    embellir,
    type Portee,
    type Question,
  } from '@jolis-mots/core';
  import { etat } from '../etat.svelte';

  /** Les questions du quiz en cours ; `null` tant que le choix n'est pas fait. */
  let questions = $state.raw<Question[] | null>(null);
  let index = $state(0);
  /** Identifiant du choix touché pour la question en cours, `null` tant qu'on n'a pas répondu. */
  let choisi = $state<string | null>(null);
  let intitule: HTMLElement | undefined = $state();
  let surQuelsMots: HTMLElement | undefined = $state();
  let defilement: HTMLElement | undefined = $state();
  let retour: HTMLElement | undefined = $state();
  let fin: HTMLElement | undefined = $state();

  const portees = $derived(compterPortees(etat.complets, etat.progres));
  const question = $derived<Question | undefined>(questions?.[index]);
  const fini = $derived(questions !== null && question === undefined);
  const total = $derived(questions?.length ?? 0);
  const repondu = $derived(choisi !== null);
  const juste = $derived(question !== undefined && choisi === question.bonne);
  /** Le mot de la bonne réponse, en minuscules (« C'était baguenauder. »). */
  const motJuste = $derived.by(() => {
    const m = etat.complets.find((c) => c.id === question?.bonne);
    return m === undefined ? '' : embellir(m.mot).toLocaleLowerCase('fr');
  });

  /**
   * Compose le quiz une seule fois, au moment du choix : répondre change `etat.progres`,
   * et le quiz en cours ne doit pas se recomposer pour autant. Sans question possible, on reste au choix.
   */
  function composer(portee: Portee): void {
    const q = composerQuiz({
      complets: etat.complets,
      progres: etat.progres,
      portee,
      nombre: etat.reglages.questionsParQuiz,
      maintenant: new Date(),
      alea: Math.random,
    });
    questions = q.length > 0 ? q : null;
    index = 0;
    choisi = null;
  }

  /** Place le curseur du clavier sur l'intitulé de la question, ou sur « Sur quels mots ? » au choix. */
  async function poserCurseur(): Promise<void> {
    await tick();
    defilement?.scrollTo({ top: 0 });
    (questions === null ? surQuelsMots : intitule)?.focus({ preventScroll: true });
  }

  function choisir(portee: Portee): void {
    if (portees[portee] === 0) return;
    composer(portee);
    void poserCurseur();
  }

  function encore(): void {
    questions = null;
    void poserCurseur();
  }

  // L'adresse peut demander un quiz (« ?quiz=vus ») : le choix est sauté, pour les captures.
  if (etat.quizDemande !== null) composer(etat.quizDemande);

  onMount(() => {
    void poserCurseur();
  });

  /** « 1 234 », milliers séparés par une espace fine insécable. */
  function nombre(n: number): string {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  async function repondre(id: string): Promise<void> {
    if (question === undefined || choisi !== null) return;
    choisi = id;
    etat.repondre(question.idMot, id === question.bonne);
    // Avec de longues définitions, le message tombe sous le pli : on le ramène à l'écran.
    await tick();
    retour?.scrollIntoView({ block: 'nearest' });
  }

  async function suivante(): Promise<void> {
    choisi = null;
    index += 1;
    await tick();
    defilement?.scrollTo({ top: 0 });
    (fini ? fin : intitule)?.focus({ preventScroll: true });
  }

  /** « 1 mot revu. », « 3 mots revus. » */
  function revus(n: number): string {
    return n > 1 ? `${n} mots revus.` : `${n} mot revu.`;
  }
</script>

<div class="quiz">
  <header class="titre">
    <span class="nom">Quiz</span>
    {#if question !== undefined}
      <span class="compte">Question {index + 1} sur {total}</span>
    {/if}
  </header>

  {#if questions === null}
    {#if portees.tous === 0}
      <div class="fin">
        <p class="vide">Aucun mot à réviser pour l’instant.</p>
      </div>
    {:else}
      <div class="defilement" bind:this={defilement}>
        <h1 class="intitule" tabindex="-1" bind:this={surQuelsMots}>Sur quels mots&#x202F;?</h1>
        <div class="portees">
          <button class="portee" onclick={() => choisir('tous')}>
            <span class="libelle">Tous les mots</span>
            <span class="nombre">{nombre(portees.tous)}</span>
          </button>
          <button
            class="portee"
            aria-disabled={portees.vus === 0}
            aria-describedby={portees.vus === 0 ? 'quiz-sans-mot-vu' : undefined}
            onclick={() => choisir('vus')}
          >
            <span class="libelle">Les mots que j’ai vus</span>
            <span class="nombre">{nombre(portees.vus)}</span>
          </button>
          {#if portees.vus === 0}
            <p class="explication" id="quiz-sans-mot-vu">Lis d’abord quelques mots&#x202F;: ils viendront ici.</p>
          {/if}
        </div>
      </div>
    {/if}
  {:else if question !== undefined}
    <div class="barre" aria-hidden="true">
      {#each questions as q, i (q.idMot)}
        <div class="segment" class:fait={i < index} class:courant={i === index}></div>
      {/each}
    </div>

    <div class="defilement" bind:this={defilement}>
      {#key index}
        <h1 class="intitule" tabindex="-1" bind:this={intitule}>
          {question.forme === 'definition-vers-mot' ? 'Quel mot correspond à cette définition\u202F?' : 'Que veut dire ce mot\u202F?'}
        </h1>
        <p class="enonce">{embellir(question.enonce)}</p>
        <p class="genre">{embellir(developperGenre(question.genre))}</p>

        <div class="choix" class:longs={question.forme === 'mot-vers-definition'}>
          {#each question.choix as c (c.id)}
            {@const estBonne = c.id === question.bonne}
            {@const estChoisi = c.id === choisi}
            <button
              class="choix-bouton"
              class:bonne={repondu && estBonne}
              class:fausse={repondu && estChoisi && !estBonne}
              class:estompe={repondu && !estBonne && !estChoisi}
              aria-disabled={repondu}
              onclick={() => repondre(c.id)}
            >
              <span class="texte">{embellir(c.texte)}</span>
              {#if repondu && estBonne}
                <svg role="img" aria-label="Bonne réponse" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
              {:else if repondu && estChoisi}
                <svg role="img" aria-label="Mauvaise réponse" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"></path></svg>
              {/if}
            </button>
          {/each}
        </div>

        <div class="retour" role="status" bind:this={retour}>
          {#if repondu}
            {#if juste}
              <p class="verdict">Juste.</p>
            {:else}
              {#if question.forme === 'definition-vers-mot'}
                <p class="verdict">C’était <em>{motJuste}</em>.</p>
              {:else}
                <p class="verdict">Ce n’était pas celle-là.</p>
              {/if}
            {/if}
          {/if}
        </div>
      {/key}
    </div>

    <div class="actions">
      {#if repondu}
        <button class="principal" onclick={suivante}>{index === total - 1 ? 'Terminer' : 'Question suivante'}</button>
      {/if}
    </div>
  {:else}
    <div class="fin">
      <p class="message" tabindex="-1" bind:this={fin}>C’est tout pour cette fois.</p>
      <p class="revus">{revus(total)}</p>
    </div>
    <div class="actions pile">
      <button class="principal" onclick={encore}>Encore un quiz</button>
      <button class="secondaire" onclick={() => etat.reprendreLecture()}>Lire des mots</button>
    </div>
  {/if}
</div>

<style>
  .quiz {
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .titre {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 14px 28px 0;
    color: var(--second);
  }

  .nom {
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .compte {
    font-size: 16px;
    font-style: italic;
  }

  .barre {
    display: flex;
    gap: 6px;
    padding: 16px 28px 0;
  }

  .segment {
    flex: 1 1 0;
    height: 2px;
    background: var(--filet);
  }

  .segment.fait {
    background: var(--encre);
  }

  .segment.courant {
    background: var(--accent);
  }

  .defilement {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 32px 28px 16px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .intitule {
    margin: 0;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--second);
  }

  .intitule:focus {
    outline: none;
  }

  /* Le choix : deux grands boutons, le nombre de mots à droite. */
  .portees {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 6px;
  }

  .portee {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    min-height: 72px;
    padding: 20px 22px;
    border: 1px solid var(--encre);
    border-radius: 12px;
    background: transparent;
    color: var(--encre);
    font-size: 24px;
    line-height: 1.2;
    text-align: left;
    cursor: pointer;
  }

  .libelle {
    min-width: 0;
  }

  .nombre {
    flex-shrink: 0;
    font-size: 20px;
    font-style: italic;
    color: var(--second);
  }

  .portee[aria-disabled='true'] {
    border-color: var(--filet);
    color: var(--second);
    cursor: default;
  }

  .explication {
    margin: -2px 0 0;
    font-size: 18px;
    font-style: italic;
    line-height: 1.35;
    color: var(--second);
  }

  .enonce {
    margin: 0;
    font-size: 30px;
    line-height: 1.22;
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  .genre {
    margin: -6px 0 0;
    font-size: 18px;
    font-style: italic;
    color: var(--second);
  }

  .choix {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
  }

  .choix-bouton {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 58px;
    padding: 12px 20px;
    border: 1px solid var(--encre);
    border-radius: 12px;
    background: transparent;
    color: var(--encre);
    font-size: 22px;
    line-height: 1.25;
    text-align: left;
    cursor: pointer;
  }

  .choix-bouton[aria-disabled='true'] {
    cursor: default;
  }

  .choix-bouton svg {
    flex-shrink: 0;
  }

  .texte {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Les définitions sont longues : texte plus petit, sur plusieurs lignes. */
  .longs .choix-bouton {
    padding: 14px 20px;
    font-size: 18px;
    line-height: 1.35;
  }

  .bonne {
    background: var(--encre);
    color: var(--papier);
  }

  .fausse {
    border-color: var(--second);
    color: var(--second);
  }

  .fausse .texte {
    text-decoration: line-through;
  }

  .estompe {
    border-color: var(--filet);
    color: var(--second);
  }

  .retour {
    min-height: 30px;
    margin-top: 8px;
  }

  .verdict {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
  }

  .verdict em {
    font-style: italic;
    font-weight: 600;
  }

  .actions {
    padding: 14px 28px 18px;
    min-height: 84px;
  }

  .actions.pile {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .principal,
  .secondaire {
    width: 100%;
    height: 52px;
    border-radius: 26px;
    font-size: 19px;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--encre);
    color: var(--papier);
  }

  .secondaire {
    border: 1px solid var(--encre);
    background: transparent;
    color: var(--encre);
  }

  .fin {
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 28px;
    text-align: center;
  }

  .message {
    margin: 0;
    font-size: 26px;
    font-weight: 500;
    line-height: 1.25;
  }

  .message:focus {
    outline: none;
  }

  .vide {
    margin: 0;
    font-size: 20px;
    font-style: italic;
    color: var(--second);
  }

  .revus {
    margin: 0;
    font-size: 20px;
    font-style: italic;
    color: var(--second);
  }
</style>
