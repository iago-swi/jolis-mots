<script lang="ts">
  import { embellir, normaliser, type EntreeHistorique } from '@jolis-mots/core';
  import Fiche from '../composants/Fiche.svelte';
  import { etat } from '../etat.svelte';
  import { volet } from '../volet';

  type Sorte = 'ajoute' | 'modifie' | 'supprime';
  const SIGNES: Record<Sorte, { signe: string; nom: string }> = {
    ajoute: { signe: '+', nom: 'ajouté' },
    modifie: { signe: '~', nom: 'modifié' },
    supprime: { signe: '−', nom: 'supprimé' },
  };

  const format = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long', timeStyle: 'short' });

  /** Du plus récent au plus ancien. */
  const entrees = $derived([...etat.historique].reverse());
  let deplie = $state<string | null>(null);
  let ouvertId = $state<string | null>(null);
  const ouvert = $derived(ouvertId === null ? null : (etat.complets.find((m) => m.id === ouvertId) ?? null));

  function date(publie: string): string {
    const t = Date.parse(publie);
    return Number.isNaN(t) ? publie : format.format(t);
  }

  /** « 1 135 mots », avec une espace fine insécable entre les milliers. */
  function nombre(n: number, unite = 'mot'): string {
    return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${n > 1 ? unite + 's' : unite}`;
  }

  /** « +1 · ~2 · −1 » ; les sortes absentes ne sont pas dites. */
  function bilan(e: EntreeHistorique): string {
    const parties: string[] = [];
    if (e.ajoutes.length > 0) parties.push(`+${e.ajoutes.length}`);
    if (e.modifies.length > 0) parties.push(`~${e.modifies.length}`);
    if (e.supprimes.length > 0) parties.push(`−${e.supprimes.length}`);
    return parties.join(' · ');
  }

  /** Les mots de l'entrée, tous ensemble par ordre alphabétique, chacun avec sa sorte. */
  function mots(e: EntreeHistorique): { id: string; mot: string; sorte: Sorte }[] {
    return [
      ...e.ajoutes.map((m) => ({ ...m, sorte: 'ajoute' as const })),
      ...e.modifies.map((m) => ({ ...m, sorte: 'modifie' as const })),
      ...e.supprimes.map((m) => ({ ...m, sorte: 'supprime' as const })),
    ].sort((a, b) => {
      const na = normaliser(a.mot);
      const nb = normaliser(b.mot);
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
  }

  function basculer(publie: string): void {
    deplie = deplie === publie ? null : publie;
  }

  /** Un mot encore dans la liste s'ouvre ; un mot supprimé depuis n'a plus de fiche. */
  function existe(id: string): boolean {
    return etat.complets.some((m) => m.id === id);
  }
</script>

<div class="historique" inert={ouvert !== null}>
  <div class="defilement">
    <header class="titre">
      <button class="retour" onclick={() => etat.allerA('reglages')}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>
        Réglages
      </button>
      <h1>Historique de la liste</h1>
    </header>

    <ol class="entrees">
      {#each entrees as e (e.publie)}
        <li class="entree">
          {#if e.debut}
            <div class="tete">
              <span class="origine">Début de l’historique</span>
              <span class="date">{date(e.publie)}</span>
              <span class="bilan">{nombre(e.total)}</span>
            </div>
          {:else}
            <button class="tete depliable" aria-expanded={deplie === e.publie} onclick={() => basculer(e.publie)}>
              <span class="origine">Envoi de l’atelier</span>
              <span class="date">{date(e.publie)}</span>
              <span class="bilan">{bilan(e)} <span class="fleche" aria-hidden="true">→</span> {nombre(e.total)}</span>
              <svg class="chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>
            </button>
            {#if deplie === e.publie}
              <ul class="mots">
                {#each mots(e) as m (m.sorte + m.id)}
                  <li class={m.sorte}>
                    <span class="signe" aria-hidden="true">{SIGNES[m.sorte].signe}</span>
                    {#if m.sorte !== 'supprime' && existe(m.id)}
                      <button class="mot" onclick={() => (ouvertId = m.id)}>{embellir(m.mot)}</button>
                    {:else}
                      <span class="mot">{embellir(m.mot)}</span>
                    {/if}
                    <span class="visuel-cache">({SIGNES[m.sorte].nom})</span>
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</div>

{#if ouvert !== null}
  <div class="volet" role="dialog" aria-modal="true" aria-label="Fiche du mot" use:volet={{ fermer: () => (ouvertId = null) }}>
    <div class="defilement"><Fiche mot={ouvert} /></div>
    <div class="actions">
      <button class="principal" data-depart onclick={() => (ouvertId = null)}>Retour à l’historique</button>
    </div>
  </div>
{/if}

<style>
  .historique {
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

  ol,
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .entrees {
    margin-top: 20px;
  }

  .entree {
    border-top: 1px solid var(--filet);
  }

  .tete {
    position: relative;
    display: grid;
    grid-template-columns: 1fr;
    gap: 2px;
    width: 100%;
    min-height: 44px;
    padding: 12px 28px 12px 0;
    border: none;
    background: transparent;
    color: var(--encre);
    font: inherit;
    text-align: left;
  }

  .depliable {
    cursor: pointer;
  }

  .origine {
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--second);
  }

  .date {
    font-size: 19px;
  }

  .bilan {
    font-size: 17px;
    font-style: italic;
    color: var(--second);
  }

  .fleche {
    font-style: normal;
  }

  .chevron {
    position: absolute;
    right: 0;
    top: 50%;
    margin-top: -9px;
    color: var(--second);
  }

  [aria-expanded='true'] .chevron {
    transform: rotate(90deg);
  }

  /* Une simple information : petite, serrée. */
  .mots {
    padding: 0 0 10px;
    font-size: 15px;
    line-height: 1.35;
  }

  .mots li {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .signe {
    width: 10px;
    flex-shrink: 0;
    text-align: center;
    color: var(--second);
  }

  .mot {
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    color: var(--encre);
    text-align: left;
  }

  button.mot {
    cursor: pointer;
  }

  .supprime .mot {
    color: var(--second);
  }

  .visuel-cache {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .volet {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--papier);
  }

  .volet .defilement {
    padding: 46px 28px 24px;
  }

  .actions {
    display: flex;
    padding: 14px 28px 18px;
  }

  .principal {
    flex: 1 1 0;
    height: 52px;
    border: none;
    border-radius: 26px;
    background: var(--encre);
    color: var(--papier);
    font-size: 19px;
    cursor: pointer;
  }

  @media (prefers-reduced-motion: no-preference) {
    .chevron {
      transition: transform 0.15s ease;
    }
  }
</style>
