<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import {
    auteursParNombre,
    developperGenre,
    embellir,
    filtrer,
    lettrine,
    lireDefinition,
    ordonner,
    type Mot,
  } from '@jolis-mots/core';
  import Fiche from '../composants/Fiche.svelte';
  import { etat } from '../etat.svelte';

  const BOUVIER = 'Nicolas Bouvier';
  const TESSON = 'Sylvain Tesson';

  interface Ligne {
    mot: Mot;
    genre: string;
    apercu: string;
  }

  let requete = $state('');
  let auteur = $state<string | null>(null);
  let favorisSeuls = $state(false);

  /** Début de définition : texte du premier sens qui en a un, sinon les synonymes, sinon rien. */
  function apercuDe(m: Mot): string {
    const sens = lireDefinition(m.definition);
    const avecTexte = sens.find((s) => s.texte !== '');
    if (avecTexte !== undefined) return avecTexte.texte;
    return sens.flatMap((s) => s.synonymes).join(', ');
  }

  const ordonnes = $derived(ordonner(etat.complets));
  /** Texte d'affichage de chaque mot, calculé une fois par liste et non à chaque frappe. */
  const lignes = $derived(
    new Map<string, Ligne>(
      ordonnes.map((m) => [
        m.id,
        { mot: m, genre: embellir(developperGenre(m.genre)), apercu: embellir(apercuDe(m)) },
      ]),
    ),
  );
  const visibles = $derived(
    filtrer(ordonnes, { requete, auteur, favoris: favorisSeuls ? etat.favoris : null }),
  );
  const groupes = $derived.by(() => {
    const res: { lettre: string; lignes: Ligne[] }[] = [];
    for (const m of visibles) {
      const lettre = lettrine(m);
      const ligne = lignes.get(m.id);
      if (ligne === undefined) continue;
      const dernier = res[res.length - 1];
      if (dernier !== undefined && dernier.lettre === lettre) dernier.lignes.push(ligne);
      else res.push({ lettre, lignes: [ligne] });
    }
    return res;
  });
  const autresAuteurs = $derived(
    auteursParNombre(etat.complets).filter((a) => a.auteur !== BOUVIER && a.auteur !== TESSON),
  );
  const autreChoisi = $derived(auteur !== null && auteur !== BOUVIER && auteur !== TESSON ? auteur : null);

  const ouvert = $derived(etat.ficheOuverte === null ? null : (etat.complets.find((m) => m.id === etat.ficheOuverte) ?? null));
  const favoriOuvert = $derived(ouvert !== null && etat.favoris.includes(ouvert.id));

  /** « 1 134 mots », avec une espace fine insécable entre les milliers. */
  function compte(n: number): string {
    return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${n > 1 ? 'mots' : 'mot'}`;
  }

  function choisir(a: string | null, favoris = false): void {
    auteur = a;
    favorisSeuls = favoris;
    etat.panneauAuteurs = false;
  }

  async function retour(): Promise<void> {
    const id = etat.ficheOuverte;
    etat.ficheOuverte = null;
    await tick();
    document.querySelector<HTMLElement>(`[data-id="${id}"]`)?.focus({ preventScroll: true });
  }

  // Quitter l'écran referme la fiche et le volet : on y revient sur la liste.
  onDestroy(() => {
    etat.ficheOuverte = null;
    etat.panneauAuteurs = false;
  });
</script>

<div class="recueil" inert={ouvert !== null || etat.panneauAuteurs}>
  <header class="titre">
    <span class="nom">Recueil</span>
    <span class="compte" aria-live="polite">{compte(visibles.length)}</span>
  </header>

  <div class="commandes">
    <div class="recherche">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"></circle><path d="M15 15l5 5"></path></svg>
      <label for="recherche">Chercher un mot</label>
      <input id="recherche" type="search" placeholder="Chercher un mot" autocomplete="off" bind:value={requete} />
    </div>
    <div class="filtres">
      <button aria-pressed={auteur === null && !favorisSeuls} onclick={() => choisir(null)}>Tous</button>
      <button aria-pressed={auteur === BOUVIER} onclick={() => choisir(BOUVIER)}>Bouvier</button>
      <button aria-pressed={auteur === TESSON} onclick={() => choisir(TESSON)}>Tesson</button>
      <button aria-pressed={favorisSeuls} onclick={() => choisir(null, true)}>Favoris</button>
      <button aria-pressed={autreChoisi !== null} aria-haspopup="dialog" onclick={() => (etat.panneauAuteurs = true)}>
        {autreChoisi === null ? 'Autres auteurs' : embellir(autreChoisi)}
      </button>
    </div>
  </div>

  <div class="liste">
    {#each groupes as g (g.lettre)}
      <h2>{g.lettre}</h2>
      {#each g.lignes as l (l.mot.id)}
        <button class="ligne" data-id={l.mot.id} onclick={() => (etat.ficheOuverte = l.mot.id)}>
          <span class="haut">
            <span class="mot">
              {embellir(l.mot.mot)}
              {#if etat.favoris.includes(l.mot.id)}
                <svg role="img" aria-label="Favori" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"></path></svg>
              {/if}
            </span>
            <span class="genre">{l.genre}</span>
          </span>
          {#if l.apercu !== ''}<span class="apercu">{l.apercu}</span>{/if}
        </button>
      {/each}
    {:else}
      <p class="vide">Aucun mot ne correspond.</p>
    {/each}
  </div>
</div>

{#if ouvert !== null}
  <section class="volet" aria-label="Fiche du mot">
    <div class="defilement"><Fiche mot={ouvert} /></div>
    <div class="actions">
      <button
        class="etoile"
        class:favori={favoriOuvert}
        aria-label="Marquer ce mot comme favori"
        aria-pressed={favoriOuvert}
        onclick={() => etat.basculerFavori(ouvert.id)}
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill={favoriOuvert ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"></path></svg>
      </button>
      <button class="principal" onclick={retour}>Retour au recueil</button>
    </div>
  </section>
{/if}

{#if etat.panneauAuteurs}
  <section class="volet" role="dialog" aria-label="Autres auteurs">
    <div class="defilement">
      <h2 class="intitule">Autres auteurs</h2>
      <ul>
        <li>
          <button class="auteur" onclick={() => choisir(null)}>Tous</button>
        </li>
        {#each autresAuteurs as a (a.auteur)}
          <li>
            <button class="auteur" aria-pressed={auteur === a.auteur} onclick={() => choisir(a.auteur)}>
              <span>{embellir(a.auteur)}</span>
              <span class="nombre">{compte(a.nombre)}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
    <div class="actions">
      <button class="principal" onclick={() => (etat.panneauAuteurs = false)}>Fermer</button>
    </div>
  </section>
{/if}

<style>
  .recueil {
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

  .commandes {
    padding: 14px 28px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .recherche {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 16px;
    border: 1px solid var(--encre);
    border-radius: 24px;
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
    font-family: inherit;
    font-size: 19px;
    color: var(--encre);
  }

  .recherche input::placeholder {
    color: var(--second);
    opacity: 1;
  }

  .recherche:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .filtres {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filtres button {
    height: 44px;
    max-width: 100%;
    padding: 0 16px;
    border: 1px solid var(--second);
    border-radius: 22px;
    background: transparent;
    color: var(--encre);
    font-size: 17px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filtres button[aria-pressed='true'] {
    border-color: var(--encre);
    background: var(--encre);
    color: var(--papier);
  }

  .liste {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px 28px 16px;
  }

  h2 {
    margin: 8px 0 0;
    padding: 6px 0;
    font-size: 30px;
    font-weight: 500;
    font-style: italic;
    color: var(--accent);
  }

  .ligne {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    min-height: 44px;
    padding: 10px 0;
    border: none;
    border-top: 1px solid var(--filet);
    background: transparent;
    text-align: left;
    cursor: pointer;
    /* Les lignes hors écran ne sont pas dessinées : la liste entière reste légère. */
    content-visibility: auto;
    contain-intrinsic-size: auto 72px;
  }

  .haut {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .mot {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 23px;
    font-weight: 500;
    overflow-wrap: anywhere;
    color: var(--encre);
  }

  .mot svg {
    flex-shrink: 0;
    color: var(--accent);
  }

  .genre {
    flex-shrink: 0;
    max-width: 50%;
    font-size: 16px;
    font-style: italic;
    text-align: right;
    color: var(--second);
  }

  .apercu {
    font-size: 16px;
    color: var(--second);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vide {
    margin: 40px 0 0;
    font-size: 20px;
    font-style: italic;
    text-align: center;
    color: var(--second);
  }

  /* Fiche et liste des auteurs recouvrent l'écran ; la liste dessous garde sa position de défilement. */
  .volet {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--papier);
  }

  .defilement {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 46px 28px 24px;
  }

  .intitule {
    margin: 0 0 12px;
    padding: 0;
    font-size: 13px;
    font-style: normal;
    font-weight: 400;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--second);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .auteur {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 10px 0;
    border: none;
    border-top: 1px solid var(--filet);
    background: transparent;
    font-size: 20px;
    text-align: left;
    cursor: pointer;
    color: var(--encre);
  }

  .auteur[aria-pressed='true'] {
    color: var(--accent);
  }

  .nombre {
    flex-shrink: 0;
    font-size: 16px;
    font-style: italic;
    color: var(--second);
  }

  .actions {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 14px 28px 18px;
  }

  .actions button {
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
