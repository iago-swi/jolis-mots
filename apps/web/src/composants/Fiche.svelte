<script lang="ts">
  import {
    afficherPages,
    developperGenre,
    developperIndication,
    embellir,
    entreGuillemets,
    lireDefinition,
    lireSource,
    tailleDuMot,
    type Mot,
  } from '@jolis-mots/core';

  let { mot }: { mot: Mot } = $props();

  const sens = $derived(lireDefinition(mot.definition));
  const sources = $derived(mot.sources.map(lireSource));

  /** Intitulé au singulier ou au pluriel selon le nombre d'éléments. */
  function intitule(singulier: string, n: number): string {
    return n > 1 ? singulier + 's' : singulier;
  }
</script>

<article class="fiche">
  {#if mot.genre.trim() !== ''}
    <p class="genre">{embellir(developperGenre(mot.genre))}</p>
  {/if}
  <h1 class="mot" style:font-size="{tailleDuMot(mot.mot)}px">{embellir(mot.mot)}</h1>
  <div class="trait" aria-hidden="true"></div>

  {#each sens as s, i (i)}
    <div class="sens">
      {#if s.numero !== null || s.indication !== null || s.texte !== ''}
        <p class="texte">
          {#if s.numero !== null}<span class="numero">{s.numero}.</span>{/if}
          {#if s.indication !== null}<span class="intitule">{embellir(developperIndication(s.indication))}</span>{/if}
          {#if s.texte !== ''}<span>{embellir(s.texte)}</span>{/if}
        </p>
      {/if}
      {#if s.usages.length > 0}
        <p class="liste">
          <span class="intitule">{intitule('Usage', s.usages.length)}</span><span class="valeur"
            >{embellir(s.usages.join(' '))}</span
          >
        </p>
      {/if}
      {#if s.synonymes.length > 0}
        <p class="liste">
          <span class="intitule">{intitule('Synonyme', s.synonymes.length)}</span><span class="valeur"
            >{embellir(s.synonymes.join(', '))}</span
          >
        </p>
      {/if}
      {#if s.antonymes.length > 0}
        <p class="liste">
          <span class="intitule">{intitule('Antonyme', s.antonymes.length)}</span><span class="valeur"
            >{embellir(s.antonymes.join(', '))}</span
          >
        </p>
      {/if}
      {#each s.exemples as exemple, j (j)}
        <p class="exemple">{entreGuillemets(embellir(exemple))}</p>
      {/each}
    </div>
  {/each}

  {#if sources.length > 0}
    <section class="sources">
      <h2>Rencontré chez</h2>
      {#each sources as src, k (k)}
        <p class="source">
          {#if src.auteur !== null}{embellir(src.auteur) + ', '}{/if}<span class="titre">{embellir(src.titre)}</span
          >{#if src.pages !== null}<span class="pages">, {afficherPages(src.pages)}</span>{/if}
        </p>
      {/each}
    </section>
  {/if}
</article>

<style>
  .fiche {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  p,
  h1,
  h2 {
    margin: 0;
  }

  .genre {
    font-size: 18px;
    font-style: italic;
    color: var(--second);
  }

  .mot {
    margin-top: -8px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }

  .trait {
    width: 44px;
    height: 2px;
    flex-shrink: 0;
    background: var(--accent);
  }

  .sens {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .texte {
    font-size: 20px;
    line-height: 1.4;
  }

  .numero {
    margin-right: 8px;
    font-weight: 600;
    color: var(--accent);
  }

  .intitule {
    margin-right: 8px;
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--second);
  }

  .liste {
    font-size: 17px;
    line-height: 1.4;
  }

  .exemple {
    padding-left: 16px;
    border-left: 1px solid var(--filet);
    font-size: 18px;
    line-height: 1.42;
    font-style: italic;
    color: var(--exemple);
  }

  .sources {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  h2 {
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--second);
  }

  .source {
    font-size: 17px;
    line-height: 1.35;
  }

  .titre {
    font-style: italic;
  }

  .pages {
    color: var(--second);
  }
</style>
